-- Create storage bucket for technician return photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('technician-returns', 'technician-returns', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload to their folder
CREATE POLICY "Authenticated users can upload return photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'technician-returns');

-- Policy: Anyone can view return photos (public bucket)
CREATE POLICY "Anyone can view return photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'technician-returns');

-- Policy: Users can delete their own uploads
CREATE POLICY "Users can delete their own return photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'technician-returns' AND auth.uid()::text = (storage.foldername(name))[1]);