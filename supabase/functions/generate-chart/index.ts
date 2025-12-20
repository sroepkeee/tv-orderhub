import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChartRequest {
  chartType: 'bar' | 'pie' | 'line' | 'doughnut' | 'gauge' | 'radar';
  data: {
    labels: string[];
    datasets: Array<{
      label?: string;
      data: number[];
      backgroundColor?: string[];
      borderColor?: string;
    }>;
  };
  options?: {
    title?: string;
    width?: number;
    height?: number;
    backgroundColor?: string;
  };
  provider?: 'quickchart' | 'ai';
  organizationId?: string;
}

// QuickChart.io configuration
const QUICKCHART_BASE_URL = 'https://quickchart.io/chart';

function generateQuickChartUrl(request: ChartRequest): string {
  const { chartType, data, options } = request;
  
  const chartConfig: Record<string, unknown> = {
    type: chartType === 'gauge' ? 'radialGauge' : chartType,
    data: data,
    options: {
      plugins: {
        title: options?.title ? {
          display: true,
          text: options.title,
          font: { size: 16, weight: 'bold' }
        } : undefined,
        legend: {
          position: chartType === 'pie' || chartType === 'doughnut' ? 'right' : 'top'
        },
        datalabels: chartType === 'pie' || chartType === 'doughnut' ? {
          display: true,
          formatter: (value: number, ctx: { chart: { data: { datasets: Array<{ data: number[] }> } } }) => {
            const sum = ctx.chart.data.datasets[0].data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / sum) * 100).toFixed(1);
            return `${percentage}%`;
          },
          color: '#fff',
          font: { weight: 'bold' }
        } : undefined
      },
      scales: chartType === 'bar' || chartType === 'line' ? {
        y: { beginAtZero: true }
      } : undefined
    }
  };

  // Special config for gauge charts
  if (chartType === 'gauge') {
    const value = data.datasets[0]?.data[0] || 0;
    return `${QUICKCHART_BASE_URL}?c=${encodeURIComponent(JSON.stringify({
      type: 'radialGauge',
      data: {
        datasets: [{
          data: [value],
          backgroundColor: getGaugeColor(value),
          borderWidth: 0
        }]
      },
      options: {
        domain: [0, 100],
        trackColor: '#e5e7eb',
        centerPercentage: 80,
        centerArea: {
          text: (val: number) => `${val}%`,
          fontSize: 24,
          fontColor: '#1f2937'
        },
        plugins: {
          title: options?.title ? {
            display: true,
            text: options.title
          } : undefined
        }
      }
    }))}&w=${options?.width || 400}&h=${options?.height || 200}&bkg=${encodeURIComponent(options?.backgroundColor || '#ffffff')}&format=png`;
  }

  const width = options?.width || 500;
  const height = options?.height || 300;
  const backgroundColor = options?.backgroundColor || '#ffffff';

  return `${QUICKCHART_BASE_URL}?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=${width}&h=${height}&bkg=${encodeURIComponent(backgroundColor)}&format=png`;
}

function getGaugeColor(value: number): string {
  if (value >= 80) return '#10b981'; // green
  if (value >= 60) return '#f59e0b'; // yellow
  return '#ef4444'; // red
}

async function fetchChartAsBase64(url: string): Promise<string> {
  console.log('Fetching chart from QuickChart:', url);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`QuickChart error: ${response.status} ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  
  return `data:image/png;base64,${base64}`;
}

async function generateChartWithAI(request: ChartRequest): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured, falling back to QuickChart');
  }

  const { chartType, data, options } = request;
  
  const prompt = `Generate a professional ${chartType} chart with the following data:
Labels: ${data.labels.join(', ')}
Values: ${data.datasets.map(d => d.data.join(', ')).join(' | ')}
${options?.title ? `Title: ${options.title}` : ''}
Style: Clean, modern, professional business chart. Use colors: ${data.datasets[0]?.backgroundColor?.join(', ') || 'blue, green, orange, red, purple'}.
The chart should be clear, readable, and suitable for a business report sent via WhatsApp.
Ultra high resolution, ${options?.width || 500}x${options?.height || 300} aspect ratio.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-image-preview',
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text']
    })
  });

  if (!response.ok) {
    throw new Error(`AI generation failed: ${response.status}`);
  }

  const result = await response.json();
  const imageUrl = result.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  
  if (!imageUrl) {
    throw new Error('No image returned from AI');
  }

  return imageUrl;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: ChartRequest = await req.json();
    console.log('Chart generation request:', JSON.stringify(request, null, 2));

    const provider = request.provider || 'quickchart';
    let chartBase64: string;

    if (provider === 'ai') {
      try {
        chartBase64 = await generateChartWithAI(request);
        console.log('Chart generated with AI');
      } catch (aiError) {
        console.warn('AI generation failed, falling back to QuickChart:', aiError);
        const url = generateQuickChartUrl(request);
        chartBase64 = await fetchChartAsBase64(url);
      }
    } else {
      const url = generateQuickChartUrl(request);
      chartBase64 = await fetchChartAsBase64(url);
      console.log('Chart generated with QuickChart');
    }

    return new Response(
      JSON.stringify({
        success: true,
        imageBase64: chartBase64,
        provider: provider
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Chart generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
