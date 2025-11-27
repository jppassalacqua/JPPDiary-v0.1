
import React, { useRef, useState, useEffect } from 'react';
import { X, Camera, RefreshCw, Check } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (base64Image: string) => void;
  onClose: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [facingMode]);

  const startCamera = async () => {
    stopCamera();
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
            facingMode: facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 }
        },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError('');
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Impossible d'accéder à la caméra. Vérifiez les permissions.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Match canvas size to video resolution
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Flip horizontal if using front camera for mirror effect
        if (facingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(base64);
      }
    }
  };

  const confirmPhoto = () => {
      if (capturedImage) {
          onCapture(capturedImage);
          stopCamera();
          onClose();
      }
  };

  const retakePhoto = () => {
      setCapturedImage(null);
  };

  const switchCamera = () => {
      setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
        <button onClick={onClose} className="p-2 bg-black/40 text-white rounded-full backdrop-blur-sm hover:bg-black/60">
            <X size={24} />
        </button>
        {!capturedImage && (
            <button onClick={switchCamera} className="p-2 bg-black/40 text-white rounded-full backdrop-blur-sm hover:bg-black/60">
                <RefreshCw size={24} />
            </button>
        )}
      </div>

      {/* Main Viewport */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
        {error ? (
            <div className="text-white text-center p-6 max-w-xs">
                <p className="mb-4 text-red-400">{error}</p>
                <button onClick={onClose} className="px-4 py-2 bg-white text-black rounded-lg font-medium">
                    Fermer
                </button>
            </div>
        ) : (
            <>
                {capturedImage ? (
                    <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
                ) : (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className={`w-full h-full object-contain ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                    />
                )}
                <canvas ref={canvasRef} className="hidden" />
            </>
        )}
      </div>

      {/* Controls */}
      <div className="bg-black p-6 pb-10 flex justify-center items-center gap-12">
         {capturedImage ? (
             <>
                <button onClick={retakePhoto} className="px-6 py-3 rounded-full bg-slate-800 text-white font-medium hover:bg-slate-700">
                    Retake
                </button>
                <button onClick={confirmPhoto} className="px-6 py-3 rounded-full bg-indigo-600 text-white font-medium hover:bg-indigo-500 flex items-center gap-2">
                    <Check size={20} /> Use Photo
                </button>
             </>
         ) : (
             <button 
                onClick={takePhoto}
                className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all"
             >
                <div className="w-12 h-12 bg-white rounded-full" />
             </button>
         )}
      </div>
    </div>
  );
};
