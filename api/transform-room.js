import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import cv from 'opencv4nodejs';
import fs from 'fs';

// Style prompts with detailed descriptions for better AI results
const stylePrompts = {
  'Scandinavian': 'Scandinavian style transformation: Replace all furniture with light blonde wood pieces - birch or pine dining tables with clean straight legs, white or light gray upholstered chairs with wooden frames, simple wooden shelving units with minimal brackets. Add white or cream colored textiles including linen curtains, wool throw blankets in soft grays and whites, and natural jute or light wood fiber rugs. Place potted plants like fiddle leaf figs, snake plants, or small succulents in simple white ceramic or light wood planters. Use white, cream, light gray, and soft beige paint colors on walls if visible. Add minimal decor like simple white ceramic vases, a few books with neutral covers, and perhaps one or two pieces of functional pottery in matte white or light gray finishes. Include natural light sources and keep surfaces completely clutter-free. CRITICAL: Keep the exact same room layout, dimensions, height, proportions, and camera angle. Do not move walls, change room size, or alter the viewing perspective.',

  'Modern': 'Modern style transformation: Install sleek furniture with clean geometric lines - glass-top dining tables with chrome or black metal legs, chairs with smooth leather or fabric upholstery in black, white, or bold colors like deep blue or red, modular shelving systems with hidden brackets. Add contemporary lighting like pendant lights with geometric shapes, floor lamps with clean cylindrical or angular designs. Use a neutral color palette of whites, grays, and blacks with one or two bold accent colors. Include modern technology elements like flat-screen displays, sleek speakers, or minimalist charging stations. Add geometric artwork, abstract sculptures, or photography in simple black or white frames. Use materials like glass, polished metal, smooth concrete, and high-gloss finishes. Keep surfaces minimal with only essential items visible. CRITICAL: Maintain the exact same room layout, dimensions, height, proportions, and camera angle. Do not alter the room structure or viewing perspective.',

  'Bohemian': 'Bohemian style transformation: Layer rich textiles everywhere - Persian or Moroccan rugs with intricate patterns in deep reds, oranges, and golds, multiple throw pillows with different patterns and textures on seating, tapestries or fabric wall hangings with paisley, mandala, or ethnic patterns. Add warm wood furniture with carved details, rattan or wicker chairs and baskets, low coffee tables with ornate legs. Fill space with plants - hanging macrame planters with trailing pothos or spider plants, large floor plants like monstera or palm trees in decorative ceramic pots with painted designs. Use warm, earthy colors like terracotta, deep burgundy, forest green, golden yellow, and burnt orange. Add eclectic decor like vintage brass lanterns, colorful glass bottles, wooden masks, ethnic sculptures, vintage books, and collections of small ornamental objects. Include warm lighting from table lamps with fabric shades, string lights, or candles. CRITICAL: Keep the exact same room layout, dimensions, height, proportions, and camera angle. Do not change the room structure or viewing perspective.',

  'Rustic': 'Rustic style transformation: Install reclaimed wood furniture with visible grain and weathered finishes - heavy wooden dining tables with thick planks and chunky legs, chairs with distressed paint or raw wood finishes, wooden shelving with live edges and metal brackets. Add natural stone elements like a stone accent wall or stone fireplace surround if space allows. Use cozy textiles like wool blankets in earth tones, burlap or linen curtains, and braided rugs in browns and creams. Include vintage or antique accessories like mason jars, metal lanterns, wooden bowls, vintage signs, and old farm tools as decor. Add natural elements like potted herbs, dried flowers in vintage containers, or small wooden planters. Use warm color palette of browns, creams, deep reds, and forest greens. Include warm lighting from Edison bulb fixtures, lantern-style lights, or candles in rustic holders. Add textures like rough-hewn wood, natural fiber baskets, and handmade pottery. CRITICAL: Maintain the exact same room layout, dimensions, height, proportions, and camera angle. Do not alter the room structure or viewing perspective.',

  'Industrial': 'Industrial style transformation: Add exposed brick walls or brick accent walls, concrete surfaces or concrete countertops, and metal fixtures throughout. Install furniture with metal frames - steel and wood dining tables with visible bolts and welds, metal chairs with industrial finishes, steel shelving units with pipe brackets. Add exposed ductwork, metal pendant lights with Edison bulbs, and track lighting with metal fixtures. Use color palette of grays, blacks, browns, and raw metal tones. Include industrial accessories like metal storage containers, vintage factory signs, gear or machinery parts as decor, and metal planters for any greenery. Add raw materials like distressed leather seating, reclaimed wood shelving, and metal mesh or wire baskets for storage. Use functional lighting with exposed bulbs, metal lamp shades, and utilitarian fixtures. Include urban elements like subway tiles, concrete floors, or metal grating patterns. CRITICAL: Keep the exact same room layout, dimensions, height, proportions, and camera angle. Do not change the room structure or viewing perspective.',

  'Minimalist': 'Minimalist style transformation: Reduce furniture to essential pieces only - simple rectangular dining table in white, black, or natural wood with clean straight legs, matching chairs with minimal design and no decorative elements, one simple shelving unit with hidden brackets. Use strictly neutral color palette of pure whites, soft grays, black, and natural wood tones. Remove all decorative objects except perhaps one single piece of art, one small plant in a simple white planter, and one minimal vase. Keep all surfaces completely clear and uncluttered. Add clean-lined lighting with simple geometric shapes, no ornate details. Use materials like smooth wood, matte metal, and clean painted surfaces. Ensure every item serves a clear function with no purely decorative elements. Create sense of space and calm through emptiness and negative space. CRITICAL: Maintain the exact same room layout, dimensions, height, proportions, and camera angle. Do not alter the room structure or viewing perspective.',

  'Traditional': 'Traditional style transformation: Add classic furniture with ornate details - wooden dining table with turned legs and carved details, upholstered chairs with button tufting and rolled arms, wooden hutch or cabinet with glass doors and decorative molding. Use rich fabrics like velvet, silk, or damask in deep colors for curtains, chair upholstery, and throw pillows. Include traditional patterns like florals, plaids, or stripes in textiles and wallpaper if visible. Add classic accessories like crystal chandeliers, table lamps with fabric shades, decorative plates, silver serving pieces, and framed family photos or classical artwork. Use warm, rich color palette including deep blues, burgundies, forest greens, and warm golds. Include antique or vintage-style pieces like wooden clocks, brass candlesticks, and ceramic vases with traditional patterns. Add formal elements like matching sets of items, symmetrical arrangements, and quality materials like solid wood and genuine leather. CRITICAL: Keep the exact same room layout, dimensions, height, proportions, and camera angle. Do not change the room structure or viewing perspective.',

  'Contemporary': 'Contemporary style transformation: Install current-trend furniture with mixed materials - dining table combining wood and metal or glass, chairs with unique shapes mixing different materials, modular furniture systems that can be reconfigured. Use neutral base colors (whites, grays, beiges) with strategic bold accent colors like emerald green, navy blue, or coral in pillows, artwork, or single accent pieces. Add statement lighting like oversized pendant lights, artistic floor lamps, or LED strip lighting. Include contemporary artwork, abstract sculptures, or photography in sleek frames. Mix textures like smooth leather, brushed metal, glass, and natural wood. Add smart home elements, modern technology integration, and current design trends. Use open shelving, floating elements, and furniture with mixed heights and proportions. Include live plants in modern planters and contemporary decorative objects with clean, current aesthetic. CRITICAL: Maintain the exact same room layout, dimensions, height, proportions, and camera angle. Do not alter the room structure or viewing perspective.',

  'Art Deco': 'Art Deco style transformation: Add glamorous furniture with geometric patterns and metallic accents - dining table with mirrored or lacquered surface and angular legs, chairs with bold geometric upholstery patterns in rich colors, furniture with chrome or brass details and sunburst motifs. Use luxurious color palette of deep blacks, rich golds, silver metallics, emerald greens, and sapphire blues. Include geometric patterns everywhere - in wallpaper, rugs, curtains, and upholstery featuring zigzags, sunbursts, chevrons, and angular designs. Add glamorous lighting like crystal chandeliers with geometric shapes, table lamps with pleated shades, and sconces with fan or sunburst designs. Include luxurious materials like velvet, silk, chrome, brass, and mirrored surfaces. Add Art Deco accessories like geometric vases, metallic picture frames, crystal decanters, and sculptures with angular, streamlined forms. Use bold, high-contrast color combinations and symmetrical arrangements. CRITICAL: Keep the exact same room layout, dimensions, height, proportions, and camera angle. Do not change the room structure or viewing perspective.',

  'Mediterranean': 'Mediterranean style transformation: Add warm, earthy furniture with rustic wood finishes - dining table with thick, weathered wood planks and wrought iron details, chairs with woven rush seats or colorful ceramic tile inlays, wooden shelving with hand-forged iron brackets. Use warm color palette of terracotta oranges, deep blues like ocean water, sunny yellows, and earthy browns. Include natural stone elements like stone accent walls, stone countertops, or stone tile floors. Add Mediterranean textiles like colorful ceramic tiles, woven rugs with geometric patterns, and curtains in warm, rich colors. Include abundant plants like olive trees in large terracotta pots, lavender, rosemary, and other Mediterranean herbs, and climbing vines if space allows. Add wrought iron accessories like candle holders, light fixtures with scrollwork, and decorative metal wall art. Use natural materials like rough-hewn wood, hand-painted ceramics, woven baskets, and natural fiber textiles. Include warm lighting from wrought iron chandeliers, ceramic table lamps, and lantern-style fixtures. CRITICAL: Maintain the exact same room layout, dimensions, height, proportions, and camera angle. Do not alter the room structure or viewing perspective.'
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

    // Save resized image temporarily for OpenCV
    const tempInputPath = `/tmp/input_${Date.now()}.png`;
    const tempOutputPath = `/tmp/outlined_${Date.now()}.png`;
    fs.writeFileSync(tempInputPath, resizedImageBuffer);

    // Use OpenCV to detect edges and draw outlines
    const inputMat = cv.imread(tempInputPath);
    const gray = inputMat.bgrToGray();
    const edges = gray.canny(100, 200);
    const lines = edges.houghLinesP(1, Math.PI/180, 50, 50, 10);
    if (lines) {
      lines.forEach(line => {
        const [x1, y1, x2, y2] = line.getPoints();
        inputMat.drawLine(new cv.Point(x1, y1), new cv.Point(x2, y2), new cv.Vec3(0, 0, 255), 2); // Red lines
      });
    }
    cv.imwrite(tempOutputPath, inputMat);
    const outlinedImageBuffer = fs.readFileSync(tempOutputPath);

    // Clean up temp files
    fs.unlinkSync(tempInputPath);
    fs.unlinkSync(tempOutputPath);

    // Prepare form data for Stability AI using formdata-node
    const { FormData, File } = await import('formdata-node');
    const formData = new FormData();
    // Set the outlined image as init_image
    formData.set('init_image', new File([outlinedImageBuffer], 'init.png', { type: 'image/png' }));

    // Then set the sampler
    formData.set('sampler', 'K_DPMPP_2M');
    
    // Use enhanced style prompt if available, otherwise fall back to basic prompt
    const styleDescription = stylePrompts[interiorStyle] || `${interiorStyle} style`;
    const prompt = `Recreate this room in ${styleDescription}. Keep the same layout, size, height, and perspective. Do not change or move any walls, windows, or doors. Respect the visible red outlines marking the room's structure. Add realistic, accurate furniture and decor matching the style. Do not change walls, windows, or structure.`;

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