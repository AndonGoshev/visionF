import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).send('ok');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageUrl, interiorStyle, roomId } = req.body;
    if (!imageUrl || !interiorStyle || !roomId) {
      return res.status(400).json({ error: 'Missing required parameters: imageUrl, interiorStyle, and roomId are required' });
    }

    const stabilityApiKey = process.env.STABILITY_API_KEY;
    const supabaseUrl = process.env.SB_URL;
    const supabaseServiceKey = process.env.SB_SERVICE_ROLE_KEY;

    if (!stabilityApiKey || !supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Missing required environment variables.' });
    }

    // Test Stability AI API key
    const accountResponse = await fetch('https://api.stability.ai/v1/user/account', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${stabilityApiKey}`,
        'Accept': 'application/json',
      },
    });
    if (!accountResponse.ok) {
      const errorText = await accountResponse.text();
      return res.status(500).json({ error: `Stability AI API key validation failed: ${accountResponse.status} - ${errorText}` });
    }

    // Download the original image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return res.status(400).json({ error: `Failed to fetch original image: ${imageResponse.status}` });
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Resize image to 1024x1024 using sharp
    const resizedImageBuffer = await sharp(imageBuffer)
      .resize(1024, 1024, { fit: 'cover' })
      .png()
      .toBuffer();

    // Prepare form data for Stability AI using formdata-node
    const { FormData, File } = await import('formdata-node');
    const formData = new FormData();
    formData.set('init_image', new File([resizedImageBuffer], 'init.png', { type: 'image/png' }));
    const prompt = `You are a professional interior designer. Your job is to enhance the given room using the ${interiorStyle.toLowerCase()} interior design style. 

Important rules:
- Do not change the room’s layout, size, perspective, proportions, or structural features (such as windows, doors, ceiling height, wall shapes, or flooring layout).
- The design must respect the original architecture and viewpoint of the image.
- Maintain the exact same position and structure of all fixed elements.
- Do not add new architectural features, openings, or extra rooms.

Your task is to *transform the interior look and feel* of the room by:
- Adding a few carefully selected furniture pieces in the ${interiorStyle} style
- Adjusting colors, textures, materials, lighting, and wall/ceiling treatments
- Ensuring the result looks realistic, professionally designed, and naturally lit
- Avoiding clutter or excessive decoration — keep it elegant and simple
- Matching real-world references for how ${interiorStyle} rooms are typically designed

The transformation should be tasteful and photorealistic. Avoid over-designing or making it look artificially generated. The final result should feel like a real, livable space with a refined design in the ${interiorStyle} style.`;

    formData.append('text_prompts[0][text]', prompt);
    formData.append('text_prompts[0][weight]', '1');
    const negativePrompt = `changing room layout, moving walls, changing windows, changing doors, changing room dimensions, changing architectural features, blurry, low quality, distorted, unrealistic, cartoon, painting, sketch`;
    formData.append('text_prompts[1][text]', negativePrompt);
    formData.append('text_prompts[1][weight]', '-1');
    formData.append('init_image_mode', 'IMAGE_STRENGTH');
    formData.append('image_strength', '0.35');
    formData.append('cfg_scale', '7');
    formData.append('samples', '1');
    formData.append('steps', '30');

    // Call Stability AI API
    const stabilityResponse = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stabilityApiKey}`,
        'Accept': 'application/json',
        // Do NOT set Content-Type; fetch will set it automatically for FormData
      },
      body: formData,
    });
    if (!stabilityResponse.ok) {
      const errorText = await stabilityResponse.text();
      return res.status(500).json({ error: `Stability AI generation failed: ${stabilityResponse.status} - ${errorText}` });
    }
    const result = await stabilityResponse.json();
    if (!result.artifacts || result.artifacts.length === 0) {
      return res.status(500).json({ error: 'No image generated by Stability AI.' });
    }
    const imageBase64 = result.artifacts[0].base64;
    const generatedImageBuffer = Buffer.from(imageBase64, 'base64');

    // Upload to Supabase Storage
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const fileName = `transformed_${roomId}_${Date.now()}.png`;
    const filePath = `transformed/${fileName}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('room-images')
      .upload(filePath, generatedImageBuffer, {
        contentType: 'image/png',
        upsert: true,
        cacheControl: '3600',
      });
    if (uploadError) {
      return res.status(500).json({ error: `Failed to upload transformed image: ${uploadError.message}` });
    }
    const { data: { publicUrl } } = supabase.storage.from('room-images').getPublicUrl(filePath);
    // Update room record
    const { error: updateError } = await supabase
      .from('rooms')
      .update({
        transformed_image_url: publicUrl,
        interior_style: interiorStyle,
      })
      .eq('id', roomId);
    if (updateError) {
      return res.status(500).json({ error: `Failed to update room record: ${updateError.message}` });
    }
    return res.status(200).json({
      success: true,
      transformedImageUrl: publicUrl,
      interiorStyle,
      roomId,
      message: 'Room transformation completed successfully',
      creditsUsed: 1,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

// comment