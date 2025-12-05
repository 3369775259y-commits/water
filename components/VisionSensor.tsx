import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';

interface VisionSensorProps {
  onHandMove: (x: number, y: number, isActive: boolean) => void;
  isActive: boolean;
  onFrameCapture?: (base64: string) => void;
  triggerCapture?: boolean;
  onVideoReady?: (video: HTMLVideoElement) => void;
}

const VisionSensor: React.FC<VisionSensorProps> = ({ 
  onHandMove, 
  isActive, 
  onFrameCapture, 
  triggerCapture,
  onVideoReady 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const requestRef = useRef<number>(0);

  // Initialize MediaPipe
  useEffect(() => {
    const initLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        setHandLandmarker(landmarker);
      } catch (err) {
        console.error("Failed to init MediaPipe:", err);
      }
    };
    initLandmarker();
  }, []);

  // Capture logic
  useEffect(() => {
    if (triggerCapture && videoRef.current && onFrameCapture) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        onFrameCapture(base64);
      }
    }
  }, [triggerCapture, onFrameCapture]);

  // Start Camera
  const enableCam = useCallback(async () => {
    if (!handLandmarker || !videoRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 }, 
          facingMode: "user" 
        }
      });
      videoRef.current.srcObject = stream;
      videoRef.current.addEventListener('loadeddata', () => {
        setCameraActive(true);
        if (onVideoReady && videoRef.current) {
          onVideoReady(videoRef.current);
        }
      });
    } catch (err) {
      console.error("Camera access denied:", err);
    }
  }, [handLandmarker, onVideoReady]);

  useEffect(() => {
    if (handLandmarker && !cameraActive) {
      enableCam();
    }
  }, [handLandmarker, cameraActive, enableCam]);

  // Detection Loop
  const predictWebcam = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !handLandmarker) return;

    // Detect
    const startTimeMs = performance.now();
    if (videoRef.current.currentTime > 0) {
      const results = handLandmarker.detectForVideo(videoRef.current, startTimeMs);

      // Draw debug
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        // Mirror the debug canvas to match the interaction feeling
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvasRef.current.width, 0);

        if (results.landmarks) {
          const drawingUtils = new DrawingUtils(ctx);
          for (const landmarks of results.landmarks) {
            drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
              color: "#00d2ff",
              lineWidth: 2
            });
            drawingUtils.drawLandmarks(landmarks, {
              color: "#ffffff",
              radius: 1,
              lineWidth: 1
            });
            
            // Extract Index Finger Tip (Index 8)
            const indexTip = landmarks[8];
            if (indexTip) {
              onHandMove(1 - indexTip.x, indexTip.y, true);
              
              // Highlight the interaction point
              ctx.beginPath();
              ctx.arc(indexTip.x * canvasRef.current.width, indexTip.y * canvasRef.current.height, 10, 0, 2 * Math.PI);
              ctx.fillStyle = "#ff00ff";
              ctx.fill();
            }
          }
          if (results.landmarks.length === 0) {
            onHandMove(0, 0, false);
          }
        }
        ctx.restore();
      }
    }
    requestRef.current = requestAnimationFrame(predictWebcam);
  }, [handLandmarker, onHandMove]);

  useEffect(() => {
    if (cameraActive) {
      requestRef.current = requestAnimationFrame(predictWebcam);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [cameraActive, predictWebcam]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden bg-gray-900 border border-gray-800 shadow-2xl">
      <video
        ref={videoRef}
        className="absolute w-full h-full object-cover transform -scale-x-100 opacity-50" 
        autoPlay
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="absolute w-full h-full object-cover pointer-events-none"
      />
      {!handLandmarker && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white z-10">
          <p className="animate-pulse font-mono">Loading Vision Models...</p>
        </div>
      )}
    </div>
  );
};

export default VisionSensor;