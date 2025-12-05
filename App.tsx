import React, { useState, useCallback } from 'react';
import { Settings, Droplets, Camera, Wand2, Loader2, Info } from 'lucide-react';
import InteractiveWater from './components/InteractiveWater';
import VisionSensor from './components/VisionSensor';
import { generateThemeFromImage } from './services/geminiService';
import { DEFAULT_CONFIG, RippleConfig, ThemeResponse } from './types';

function App() {
  const [interactionPoint, setInteractionPoint] = useState({ x: 0.5, y: 0.5, active: false });
  const [config, setConfig] = useState<RippleConfig>(DEFAULT_CONFIG);
  const [showDebug, setShowDebug] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [captureTrigger, setCaptureTrigger] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  const handleHandMove = useCallback((x: number, y: number, isActive: boolean) => {
    setInteractionPoint({ x, y, active: isActive });
  }, []);

  const handleGeminiAnalysis = useCallback(async (base64Image: string) => {
    setCaptureTrigger(false); 
    setIsAnalyzing(true);
    try {
      const theme: ThemeResponse = await generateThemeFromImage(base64Image);
      
      setConfig(prev => ({
        ...prev,
        baseColor: theme.baseColor,
        highlightColor: theme.highlightColor,
        damping: theme.damping,
        shimmer: theme.shimmer,
        label: theme.label
      }));
      setLastAnalysis(theme.description);

    } catch (error) {
      console.error("Analysis failed", error);
      alert("Failed to analyze environment. Try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const triggerAnalysis = () => {
    setCaptureTrigger(true);
  };

  const handleVideoReady = useCallback((video: HTMLVideoElement) => {
    setVideoElement(video);
  }, []);

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-sans text-white">
      
      {/* Background/Water Layer (Now AR) */}
      <div className="absolute inset-0 z-0">
        <InteractiveWater 
          config={config} 
          interactionPoint={interactionPoint} 
          videoSource={videoElement} 
        />
      </div>

      {/* Foreground UI Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6">
        
        {/* Header */}
        <div className="flex justify-between items-start pointer-events-auto">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter drop-shadow-lg" style={{ color: config.highlightColor }}>
              AETHER AR
            </h1>
            <p className="text-white/80 text-sm mt-1 max-w-md drop-shadow-md">
              Touch the air to ripple reality.
            </p>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setShowDebug(!showDebug)}
              className={`p-3 rounded-full backdrop-blur-md transition-all ${showDebug ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'bg-black/20 border-white/10 hover:bg-black/40'} border`}
            >
              <Camera size={20} />
            </button>
            <button 
              onClick={triggerAnalysis}
              disabled={isAnalyzing}
              className="group flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />}
              <span className="font-semibold">{isAnalyzing ? 'Scanning Room...' : 'Scan Environment'}</span>
            </button>
          </div>
        </div>

        {/* Center Hint if Idle */}
        {!interactionPoint.active && !showDebug && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center opacity-70 pointer-events-none transition-opacity duration-500 mix-blend-overlay">
             <div className="w-24 h-24 border border-white/40 rounded-full animate-ping mx-auto mb-4" />
             <p className="text-xl font-light tracking-[0.5em] text-white">REACH OUT</p>
          </div>
        )}

        {/* Debug View / Vision Sensor (Always mounted for logic, hidden if needed) */}
        {/* We keep it mounted so it maintains video stream state */}
        <div className={`absolute top-24 right-6 w-64 aspect-[4/3] transition-all duration-300 pointer-events-auto ${showDebug ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 pointer-events-none'}`}>
          <VisionSensor 
            onHandMove={handleHandMove} 
            isActive={true} 
            onFrameCapture={handleGeminiAnalysis}
            triggerCapture={captureTrigger}
            onVideoReady={handleVideoReady}
          />
          <div className="mt-2 text-xs text-white/80 font-mono text-right bg-black/50 p-1 rounded">
             X: {interactionPoint.x.toFixed(2)} Y: {interactionPoint.y.toFixed(2)}
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div className="flex items-end justify-between pointer-events-auto">
          
          {/* Active Theme Info */}
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 max-w-sm transition-all hover:bg-black/60 shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Droplets size={16} className="text-white/60" />
              <span className="text-xs font-bold uppercase tracking-wider text-white/60">Fluid Simulation</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-1" style={{ textShadow: `0 0 10px ${config.baseColor}` }}>
              {config.label}
            </h2>
            {lastAnalysis && (
              <p className="text-xs text-white/70 leading-relaxed border-l-2 border-white/20 pl-2 my-2 italic">
                "{lastAnalysis}"
              </p>
            )}
             <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-white/5">
                <div>
                  <div className="text-[10px] text-gray-400 uppercase">Viscosity</div>
                  <div className="h-1 w-full bg-white/20 rounded mt-1 overflow-hidden">
                    <div className="h-full bg-white transition-all duration-500" style={{ width: `${(config.damping - 0.8) * 500}%` }} />
                  </div>
                </div>
                <div>
                   <div className="text-[10px] text-gray-400 uppercase">Refraction</div>
                   <div className="h-1 w-full bg-white/20 rounded mt-1 overflow-hidden">
                     <div className="h-full bg-white transition-all duration-500" style={{ width: `${(config.shimmer / 20) * 100}%` }} />
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;