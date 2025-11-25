import { supabase } from "@/integrations/supabase/client";

interface BrowserInfo {
  name: string;
  version: string;
}

interface OSInfo {
  name: string;
  version: string;
}

const getBrowserInfo = (userAgent: string): BrowserInfo => {
  let name = "Unknown";
  let version = "";

  if (userAgent.includes("Edg/")) {
    name = "Edge";
    version = userAgent.match(/Edg\/([\d.]+)/)?.[1] || "";
  } else if (userAgent.includes("Chrome/")) {
    name = "Chrome";
    version = userAgent.match(/Chrome\/([\d.]+)/)?.[1] || "";
  } else if (userAgent.includes("Safari/") && !userAgent.includes("Chrome")) {
    name = "Safari";
    version = userAgent.match(/Version\/([\d.]+)/)?.[1] || "";
  } else if (userAgent.includes("Firefox/")) {
    name = "Firefox";
    version = userAgent.match(/Firefox\/([\d.]+)/)?.[1] || "";
  }

  return { name, version };
};

const getOSInfo = (userAgent: string): OSInfo => {
  let name = "Unknown";
  let version = "";

  if (userAgent.includes("Windows NT")) {
    name = "Windows";
    const ntVersion = userAgent.match(/Windows NT ([\d.]+)/)?.[1];
    if (ntVersion === "10.0") version = "11/10";
    else if (ntVersion === "6.3") version = "8.1";
    else if (ntVersion === "6.2") version = "8";
    else if (ntVersion === "6.1") version = "7";
  } else if (userAgent.includes("Mac OS X")) {
    name = "macOS";
    version = userAgent.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, ".") || "";
  } else if (userAgent.includes("Linux")) {
    name = "Linux";
  } else if (userAgent.includes("Android")) {
    name = "Android";
    version = userAgent.match(/Android ([\d.]+)/)?.[1] || "";
  } else if (userAgent.includes("iOS")) {
    name = "iOS";
    version = userAgent.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, ".") || "";
  }

  return { name, version };
};

export async function trackLogin(userId: string, method: 'email' | 'azure') {
  const userAgent = navigator.userAgent;
  
  // Capturar IP via serviço público
  let ipAddress = null;
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    ipAddress = data.ip;
  } catch (error) {
    console.warn('Não foi possível capturar IP:', error);
  }

  const browser = getBrowserInfo(userAgent);
  const os = getOSInfo(userAgent);

  const description = method === 'azure' 
    ? 'Fez login via Microsoft' 
    : 'Fez login via email/senha';

  await supabase.from('user_activity_log').insert({
    user_id: userId,
    action_type: 'login',
    description,
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: {
      timestamp: new Date().toISOString(),
      login_method: method,
      browser: {
        name: browser.name,
        version: browser.version
      },
      os: {
        name: os.name,
        version: os.version
      }
    }
  });
}
