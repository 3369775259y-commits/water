import React, { useEffect, useRef } from 'react';
import { RippleConfig } from '../types';

interface InteractiveWaterProps {
  config: RippleConfig;
  interactionPoint: { x: number; y: number; active: boolean };
  videoSource: HTMLVideoElement | null;
}

const InteractiveWater: React.FC<InteractiveWaterProps> = ({ config, interactionPoint, videoSource }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buffer1Ref = useRef<Int16Array>(new Int16Array(0));
  const buffer2Ref = useRef<Int16Array>(new Int16Array(0));
  const dimensionsRef = useRef({ w: 0, h: 0 });
  const animationRef = useRef<number>(0);
  const imageDataBufferRef = useRef<ImageData | null>(null);

  // Initialize buffers
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current) return;
      const { clientWidth, clientHeight } = canvasRef.current;
      
      // Use a moderate resolution for performance balance between physics and visual quality
      // 0.5 is good for high DPI screens
      const scale = 0.5;
      const w = Math.floor(clientWidth * scale);
      const h = Math.floor(clientHeight * scale);

      canvasRef.current.width = w;
      canvasRef.current.height = h;
      dimensionsRef.current = { w, h };

      buffer1Ref.current = new Int16Array(w * h);
      buffer2Ref.current = new Int16Array(w * h);
      // Pre-allocate ImageData to avoid garbage collection
      // We can't pre-allocate the main one easily as context changes, but we can manage it in loop
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Interaction Effect
  useEffect(() => {
    if (interactionPoint.active && dimensionsRef.current.w > 0) {
      const { w, h } = dimensionsRef.current;
      const x = Math.floor(interactionPoint.x * w);
      const y = Math.floor(interactionPoint.y * h);
      
      // Add ripple at position
      const radius = 4; // Slightly larger for AR visibility
      const strength = 600; 

      for (let j = y - radius; j < y + radius; j++) {
        for (let i = x - radius; i < x + radius; i++) {
          if (i >= 0 && i < w && j >= 0 && j < h) {
            // Check circular distance for smoother drop
            if ((i - x) * (i - x) + (j - y) * (j - y) < radius * radius) {
                buffer1Ref.current[j * w + i] = strength;
            }
          }
        }
      }
    }
  }, [interactionPoint]);

  // Physics & Render Loop
  useEffect(() => {
    const renderloop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const { w, h } = dimensionsRef.current;
      if (w === 0 || h === 0) return;

      const buffer1 = buffer1Ref.current;
      const buffer2 = buffer2Ref.current;
      const damping = config.damping;

      // 1. Draw Background (Video Feed)
      // We flip horizontally to match the "Mirror" effect
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      if (videoSource && videoSource.readyState >= 2) {
        ctx.drawImage(videoSource, 0, 0, w, h);
      } else {
        // Fallback if no video yet
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();

      // 2. Capture the video frame as a texture
      const textureImage = ctx.getImageData(0, 0, w, h);
      const texture = textureImage.data;
      
      // Prepare output buffer (reuse existing ImageData if possible or create new)
      if (!imageDataBufferRef.current || imageDataBufferRef.current.width !== w || imageDataBufferRef.current.height !== h) {
          imageDataBufferRef.current = ctx.createImageData(w, h);
      }
      const outputImage = imageDataBufferRef.current;
      const output = outputImage.data;

      // Parse colors for tinting
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
      }
      const base = hexToRgb(config.baseColor);
      const highlight = hexToRgb(config.highlightColor);

      // 3. Physics & Refraction Pixel Loop
      for (let i = w + 1; i < w * h - w - 1; i++) {
        // --- Ripple Physics ---
        buffer2[i] = ((buffer1[i - 1] + buffer1[i + 1] + buffer1[i - w] + buffer1[i + w]) >> 1) - buffer2[i];
        buffer2[i] = Math.floor(buffer2[i] * damping);
        
        // --- Rendering ---
        
        // Calculate gradients (slope) for refraction
        const xOffset = buffer2[i - 1] - buffer2[i + 1];
        const yOffset = buffer2[i - w] - buffer2[i + w];
        
        // Determine distortion amount
        // config.shimmer scales the refraction intensity
        const distortionX = Math.floor(xOffset * 0.05 * config.shimmer);
        const distortionY = Math.floor(yOffset * 0.05 * config.shimmer);
        
        // Current pixel coordinates
        const y = Math.floor(i / w);
        const x = i % w;

        // Sample coordinates (Where to look in the video texture)
        let sourceX = x + distortionX;
        let sourceY = y + distortionY;

        // Clamp to boundaries
        if (sourceX < 0) sourceX = 0; if (sourceX >= w) sourceX = w - 1;
        if (sourceY < 0) sourceY = 0; if (sourceY >= h) sourceY = h - 1;

        const targetIdx = i * 4;
        const sourceIdx = (sourceY * w + sourceX) * 4;

        // Apply Refraction (copy pixel from displaced location)
        // Apply a subtle tint based on the 'baseColor'
        // If distortion is high, we might mix more baseColor to simulate thickness
        const tintFactor = Math.min(1.0, (Math.abs(distortionX) + Math.abs(distortionY)) / 20);
        
        output[targetIdx] = texture[sourceIdx];     // R
        output[targetIdx + 1] = texture[sourceIdx + 1]; // G
        output[targetIdx + 2] = texture[sourceIdx + 2]; // B
        output[targetIdx + 3] = 255;                  // A

        // --- Specular Highlights ---
        // If the slope is steep and facing the light (arbitrary light direction), add highlight
        // Simple directional light from top-left
        const shading = xOffset - yOffset; 
        
        if (shading > 10) {
            const intensity = Math.min(255, shading * 2);
            output[targetIdx] = Math.min(255, output[targetIdx] + intensity * (highlight.r / 255));
            output[targetIdx+1] = Math.min(255, output[targetIdx+1] + intensity * (highlight.g / 255));
            output[targetIdx+2] = Math.min(255, output[targetIdx+2] + intensity * (highlight.b / 255));
        } 
        
        // --- Tinting for "Liquid" feel ---
        // If it's a "Lava" theme, we want red tint.
        if (tintFactor > 0.05) {
             output[targetIdx] = output[targetIdx] * (1 - tintFactor * 0.5) + base.r * (tintFactor * 0.5);
             output[targetIdx+1] = output[targetIdx+1] * (1 - tintFactor * 0.5) + base.g * (tintFactor * 0.5);
             output[targetIdx+2] = output[targetIdx+2] * (1 - tintFactor * 0.5) + base.b * (tintFactor * 0.5);
        }
      }

      ctx.putImageData(outputImage, 0, 0);

      // Swap buffers
      const temp = buffer1Ref.current;
      buffer1Ref.current = buffer2Ref.current;
      buffer2Ref.current = temp;

      animationRef.current = requestAnimationFrame(renderloop);
    };

    animationRef.current = requestAnimationFrame(renderloop);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [config, videoSource]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full block touch-none"
      style={{ imageRendering: 'pixelated' }}
    />
  );
};

export default InteractiveWater;