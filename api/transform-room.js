import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// Style prompts with detailed descriptions for better AI results
const stylePrompts = {
  'Scandinavian': 'Scandinavian style: Light wood furniture, minimal decor, neutral colors (whites, grays, beiges), natural materials, clean lines, functional design, lots of natural light, cozy hygge elements, simple geometric patterns, natural textures like wool and linen',
  'Modern': 'Modern style: Sleek furniture, geometric shapes, neutral color palette, clean lines, minimal clutter, open spaces, contemporary art, statement lighting, smooth surfaces, bold accents, technology integration',
  'Bohemian': 'Bohemian style: Eclectic mix of patterns and textures, warm earthy colors, layered textiles, vintage furniture, plants, artistic elements, free-spirited and creative atmosphere, global influences, handmade items, rich jewel tones',
  'Rustic': 'Rustic style: Natural wood elements, stone features, warm earth tones, vintage or distressed furniture, cozy textiles, natural materials, exposed beams, farmhouse charm, comfortable and inviting atmosphere, traditional craftsmanship',
  'Industrial': 'Industrial style: Exposed brick walls, metal fixtures, raw materials, neutral color palette, vintage machinery elements, open ductwork, concrete floors, leather furniture, Edison bulbs, urban warehouse aesthetic',
  'Minimalist': 'Minimalist style: Clean lines, uncluttered spaces, neutral color palette, functional furniture, hidden storage, simple geometric shapes, natural light, quality over quantity, zen-like atmosphere, essential items only',
  'Traditional': 'Traditional style: Classic furniture, rich fabrics, warm color palette, ornate details, symmetry, formal arrangement, antique pieces, elegant lighting, sophisticated patterns, timeless elegance',
  'Contemporary': 'Contemporary style: Current design trends, clean lines, neutral colors with bold accents, open floor plans, natural materials, large windows, comfortable yet sophisticated, current technology integration',
  'Art Deco': 'Art Deco style: Geometric patterns, bold colors, luxurious materials, symmetrical designs, metallic accents, glamorous lighting, rich textures, sophisticated elegance, 1920s-1930s aesthetic, statement pieces',
  'Mediterranean': 'Mediterranean style: Warm earth tones, terracotta tiles, wrought iron details, natural stone, arched doorways, rustic furniture, vibrant colors, outdoor-indoor living, coastal influences, relaxed elegance'
};

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
    // Set the image first
    formData.set('init_image', new File([resizedImageBuffer], 'init.png', { type: 'image/png' }));

    // Then set the sampler
    formData.set('sampler', 'K_DPMPP_2M');
    
    // Use enhanced style prompt if available, otherwise fall back to basic prompt
    const styleDescription = stylePrompts[interiorStyle] || `${interiorStyle} style`;
    const prompt = `Recreate this room in ${styleDescription}. Keep the same layout, size, height, and perspective. Add realistic, accurate furniture and decor matching the style. Do not change walls, windows, or structure.`;

    formData.append('text_prompts[0][text]', prompt);
    formData.append('text_prompts[0][weight]', '1');
    const negativePrompt = `low resolution, painting, changing room layout, moving walls, changing windows, changing doors, changing room dimensions, changing architectural features, blurry, low quality, distorted, unrealistic, cartoon, painting, sketch`;
    formData.append('text_prompts[1][text]', negativePrompt);
    formData.append('text_prompts[1][weight]', '-1');
    formData.append('init_image_mode', 'IMAGE_STRENGTH');
    formData.append('image_strength', '0.35');
    formData.append('cfg_scale', '11');
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