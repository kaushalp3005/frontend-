"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import QrScanner from 'qr-scanner';
import { Camera, X, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface HighPerformanceQRScannerProps {
  onScanSuccess: (result: string) => void;
  onScanError?: (error: string) => void;
  onClose?: () => void;
  roiConfig?: {
    widthPercentage?: number;
    heightPercentage?: number;
  };
}

export default function HighPerformanceQRScanner({
  onScanSuccess,
  onScanError,
  onClose,
  roiConfig
}: HighPerformanceQRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const isMountedRef = useRef(true);
  const hasScannedRef = useRef(false);
  const onScanSuccessRef = useRef(onScanSuccess);
  const onScanErrorRef = useRef(onScanError);
  const onCloseRef = useRef(onClose);

  const [isCameraReady, setIsCameraReady] = useState(false);
  const [error, setError] = useState('');
  const [scanFlash, setScanFlash] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');

  // Keep callback refs current
  useEffect(() => { onScanSuccessRef.current = onScanSuccess; }, [onScanSuccess]);
  useEffect(() => { onScanErrorRef.current = onScanError; }, [onScanError]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Initialize scanner on mount
  useEffect(() => {
    isMountedRef.current = true;
    hasScannedRef.current = false;
    let active = true;
    let scanner: QrScanner | null = null;

    const init = async () => {
      // Wait one animation frame so React StrictMode's rapid
      // mount→cleanup→remount skips the first mount entirely
      await new Promise<void>(r => requestAnimationFrame(() => r()));
      if (!active || !videoRef.current) return;

      // Pre-flight checks
      if (!window.isSecureContext) {
        setError(
          'Camera requires HTTPS or localhost. Current: ' +
          window.location.protocol + '//' + window.location.host
        );
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera API not available in this browser');
        return;
      }

      try {
        scanner = new QrScanner(
          videoRef.current,
          (result) => {
            // Guard: only fire once, and never after unmount
            if (!active || hasScannedRef.current) return;
            hasScannedRef.current = true;

            // Feedback
            setScanFlash(true);
            try { navigator.vibrate?.(80); } catch (_) {}

            // Stop scanning (safe — just pauses, doesn't destroy from inside callback)
            try { scanner?.stop(); } catch (_) {}

            // Notify parent — they will typically unmount us
            onScanSuccessRef.current(result.data);
          },
          {
            returnDetailedScanResult: true,
            highlightScanRegion: false,
            highlightCodeOutline: false,
            maxScansPerSecond: 20,
            preferredCamera: 'environment',
            calculateScanRegion: (video) => {
              const wp = (roiConfig?.widthPercentage || 55) / 100;
              const hp = (roiConfig?.heightPercentage || 55) / 100;
              const w = Math.floor(video.videoWidth * wp);
              const h = Math.floor(video.videoHeight * hp);
              return {
                x: Math.floor((video.videoWidth - w) / 2),
                y: Math.floor((video.videoHeight - h) / 2),
                width: w,
                height: h,
                downScaledWidth: Math.min(w, 400),
                downScaledHeight: Math.min(h, 400),
              };
            },
          }
        );

        scanner.setInversionMode('original');
        scannerRef.current = scanner;

        await scanner.start();

        // Request continuous autofocus for sharper QR reads (mobile/tablet)
        try {
          const stream = videoRef.current?.srcObject as MediaStream;
          const track = stream?.getVideoTracks()[0];
          const caps = track?.getCapabilities?.() as any;
          if (caps?.focusMode?.includes('continuous')) {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
          }
        } catch (_) { /* not all devices support this */ }

        // Double-check we weren't cleaned up while awaiting
        if (!active) {
          scanner.stop();
          scanner.destroy();
          scannerRef.current = null;
          return;
        }

        setIsCameraReady(true);
      } catch (err: any) {
        if (!active) return;
        const msg = err?.message || 'Failed to start camera';
        setError(msg);
        onScanErrorRef.current?.(msg);
      }
    };

    init();

    // Cleanup: runs on unmount (or StrictMode's first-mount teardown)
    return () => {
      active = false;
      isMountedRef.current = false;
      if (scanner) {
        try { scanner.stop(); } catch (_) {}
        try { scanner.destroy(); } catch (_) {}
      }
      scannerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    if (scannerRef.current) {
      try { scannerRef.current.stop(); } catch (_) {}
      try { scannerRef.current.destroy(); } catch (_) {}
      scannerRef.current = null;
    }
    onCloseRef.current?.();
  }, []);

  const handleManualSubmit = useCallback(() => {
    const val = manualBarcode.trim();
    if (!val) return;
    hasScannedRef.current = true;
    setScanFlash(true);
    try { navigator.vibrate?.(80); } catch (_) {}
    if (scannerRef.current) {
      try { scannerRef.current.stop(); } catch (_) {}
      try { scannerRef.current.destroy(); } catch (_) {}
      scannerRef.current = null;
    }
    onScanSuccessRef.current(val);
  }, [manualBarcode]);

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden select-none">
      {/* Video feed */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {/* Green flash on successful scan */}
      {scanFlash && (
        <div className="absolute inset-0 bg-green-400/30 pointer-events-none z-20 transition-opacity duration-300" />
      )}

      {/* Scan overlay with viewfinder */}
      {isCameraReady && !showManualEntry && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Vignette overlay */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.55) 70%)'
          }} />

          {/* Viewfinder box */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative w-52 h-52 sm:w-64 sm:h-64 md:w-72 md:h-72">
              {/* Corners */}
              <div className="absolute top-0 left-0 w-10 h-10 border-t-[3px] border-l-[3px] border-green-400 rounded-tl-sm" />
              <div className="absolute top-0 right-0 w-10 h-10 border-t-[3px] border-r-[3px] border-green-400 rounded-tr-sm" />
              <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[3px] border-l-[3px] border-green-400 rounded-bl-sm" />
              <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[3px] border-r-[3px] border-green-400 rounded-br-sm" />

              {/* Scan line */}
              <div className="absolute left-1 right-1 h-[2px] bg-green-400/80 shadow-[0_0_8px_rgba(74,222,128,0.6)] animate-[scanLine_2s_ease-in-out_infinite]" />
            </div>
          </div>

          {/* Hint text */}
          <div className="absolute bottom-4 left-0 right-0 text-center">
            <span className="text-white/80 text-xs sm:text-sm bg-black/40 px-3 py-1 rounded-full">
              Align QR code within the frame
            </span>
          </div>
        </div>
      )}

      {/* Loading state */}
      {!isCameraReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="text-center text-white">
            <Camera className="w-10 h-10 mx-auto mb-3 animate-pulse opacity-70" />
            <p className="text-sm font-medium">Starting Camera...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !showManualEntry && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-4 z-10">
          <div className="text-center text-white max-w-sm w-full space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
              <X className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-sm font-medium">Camera Not Available</p>
            <p className="text-xs text-gray-400">{error}</p>

            {!window.isSecureContext && (
              <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-left">
                <p className="text-xs text-yellow-300">
                  Camera needs HTTPS or localhost.
                  Use <span className="font-mono">http://localhost:3000</span> on laptop or ngrok for mobile.
                </p>
              </div>
            )}

            <Button
              onClick={() => setShowManualEntry(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Keyboard className="w-4 h-4 mr-2" />
              Enter Barcode Manually
            </Button>
          </div>
        </div>
      )}

      {/* Manual entry overlay */}
      {showManualEntry && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-4 z-10">
          <div className="bg-white rounded-lg p-5 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-semibold text-gray-800 mb-3">Enter Barcode</h3>
            <Input
              type="text"
              placeholder="Scan or type barcode..."
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit(); }}
              className="text-base mb-3"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                onClick={() => { setShowManualEntry(false); setManualBarcode(''); }}
                variant="outline"
                className="flex-1"
                size="sm"
              >
                Back
              </Button>
              <Button
                onClick={handleManualSubmit}
                disabled={!manualBarcode.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Top-right controls */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2 pointer-events-auto">
        {isCameraReady && !showManualEntry && (
          <Button
            onClick={() => setShowManualEntry(true)}
            variant="ghost"
            size="icon"
            className="bg-black/40 hover:bg-black/60 text-white rounded-full w-9 h-9"
            title="Manual entry"
          >
            <Keyboard className="w-4 h-4" />
          </Button>
        )}
        <Button
          onClick={handleClose}
          variant="ghost"
          size="icon"
          className="bg-black/40 hover:bg-black/60 text-white rounded-full w-9 h-9"
          title="Close scanner"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Keyframes for scan line animation */}
      <style jsx>{`
        @keyframes scanLine {
          0%, 100% { top: 4px; }
          50% { top: calc(100% - 6px); }
        }
      `}</style>
    </div>
  );
}
