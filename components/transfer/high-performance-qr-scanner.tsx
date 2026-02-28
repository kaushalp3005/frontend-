"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import QrScanner from 'qr-scanner';
import { Camera, X, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const SCAN_COOLDOWN_MS = 2000; // 2-second cooldown between scans of the same QR

interface HighPerformanceQRScannerProps {
  onScanSuccess: (result: string) => void;
  onScanError?: (error: string) => void;
  onClose?: () => void;
  /** When true, scanner stays open after each scan instead of stopping. Default: false */
  continuous?: boolean;
  /** Already-scanned QR values — scanner skips these to avoid re-firing onScanSuccess */
  scannedValues?: Set<string>;
  /** Shown as a badge overlay in continuous mode, e.g. "3/5" */
  matchProgress?: string;
}

export default function HighPerformanceQRScanner({
  onScanSuccess,
  onScanError,
  onClose,
  continuous = false,
  scannedValues,
  matchProgress,
}: HighPerformanceQRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const [scannerType, setScannerType] = useState<'native' | 'library' | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [scanFlash, setScanFlash] = useState<string | null>(null);

  // Refs to avoid stale closures in the scan loop
  const onScanSuccessRef = useRef(onScanSuccess);
  const scannedValuesRef = useRef(scannedValues);
  const continuousRef = useRef(continuous);
  const lastScannedRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);
  const isScanningRef = useRef(false);

  // Keep refs in sync with props
  useEffect(() => { onScanSuccessRef.current = onScanSuccess; }, [onScanSuccess]);
  useEffect(() => { scannedValuesRef.current = scannedValues; }, [scannedValues]);
  useEffect(() => { continuousRef.current = continuous; }, [continuous]);

  // Cooldown / dedup check
  const isDuplicateOrCooldown = useCallback((value: string): boolean => {
    const now = Date.now();
    if (value === lastScannedRef.current && (now - lastScanTimeRef.current) < SCAN_COOLDOWN_MS) {
      return true;
    }
    if (scannedValuesRef.current?.has(value)) {
      return true;
    }
    return false;
  }, []);

  // Show scan flash in continuous mode
  const showScanFlash = useCallback((message: string) => {
    setScanFlash(message);
    setTimeout(() => setScanFlash(null), 800);
  }, []);

  // Check if BarcodeDetector API is available
  const checkBarcodeDetectorSupport = async (): Promise<boolean> => {
    if (!('BarcodeDetector' in window)) return false;
    try {
      const formats = await (window as any).BarcodeDetector.getSupportedFormats();
      return formats.includes('qr_code');
    } catch {
      return false;
    }
  };

  // Initialize native BarcodeDetector scanner
  const initNativeBarcodeScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 60, min: 30 },
          aspectRatio: { ideal: 16 / 9 }
        }
      });

      if (!videoRef.current) return;

      streamRef.current = stream;
      videoRef.current.srcObject = stream;

      await new Promise((resolve, reject) => {
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = resolve;
          videoRef.current.onerror = reject;
        }
      });

      try {
        await videoRef.current.play();
      } catch {
        await new Promise(resolve => setTimeout(resolve, 500));
        await videoRef.current.play();
      }

      setIsCameraReady(true);
      setIsScanning(true);
      isScanningRef.current = true;
      setScannerType('native');

      const barcodeDetector = new (window as any).BarcodeDetector({
        formats: ['qr_code']
      });

      // Start continuous scanning
      const scanFrame = async () => {
        if (!videoRef.current || !canvasRef.current || !isScanningRef.current) return;

        try {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return;

          // ROI: crop to center 50% of the smaller dimension
          const smallerDimension = Math.min(video.videoWidth, video.videoHeight);
          const roiSize = Math.floor(smallerDimension * 0.5);
          const roiX = Math.floor((video.videoWidth - roiSize) / 2);
          const roiY = Math.floor((video.videoHeight - roiSize) / 2);

          canvas.width = roiSize;
          canvas.height = roiSize;

          // Draw only the ROI portion of the video
          ctx.drawImage(
            video,
            roiX, roiY, roiSize, roiSize,
            0, 0, roiSize, roiSize
          );

          const barcodes = await barcodeDetector.detect(canvas);

          if (barcodes.length > 0) {
            const qrCode = barcodes[0].rawValue;

            // Cooldown / dedup check
            if (isDuplicateOrCooldown(qrCode)) {
              animationFrameRef.current = requestAnimationFrame(scanFrame);
              return;
            }

            lastScannedRef.current = qrCode;
            lastScanTimeRef.current = Date.now();

            if (continuousRef.current) {
              // Continuous mode: fire callback, show flash, pause then resume
              onScanSuccessRef.current(qrCode);
              showScanFlash('Scanned!');
              setTimeout(() => {
                if (isScanningRef.current) {
                  animationFrameRef.current = requestAnimationFrame(scanFrame);
                }
              }, SCAN_COOLDOWN_MS);
              return;
            } else {
              // Single-scan mode: stop and fire
              stopScanning();
              onScanSuccessRef.current(qrCode);
              return;
            }
          }

          animationFrameRef.current = requestAnimationFrame(scanFrame);
        } catch {
          animationFrameRef.current = requestAnimationFrame(scanFrame);
        }
      };

      scanFrame();

    } catch (err: any) {
      console.error('Native scanner initialization failed:', err);
      setError(err.message || 'Failed to initialize native scanner');
      initLibraryScanner();
    }
  };

  // Initialize qr-scanner library as fallback
  const initLibraryScanner = async () => {
    try {
      if (!videoRef.current) throw new Error('Video element not ready');

      if (!window.isSecureContext) {
        throw new Error('Camera requires HTTPS or localhost. Current URL: ' + window.location.protocol + '//' + window.location.host);
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available in this browser');
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      try {
        const testStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        testStream.getTracks().forEach(track => track.stop());
      } catch {
        throw new Error('Camera permission denied. Please allow camera access in browser settings.');
      }

      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          const qrCode = result.data;

          // Cooldown / dedup check
          if (isDuplicateOrCooldown(qrCode)) return;

          lastScannedRef.current = qrCode;
          lastScanTimeRef.current = Date.now();

          if (continuousRef.current) {
            // Continuous mode: fire callback, show flash, keep scanning
            onScanSuccessRef.current(qrCode);
            showScanFlash('Scanned!');
            // Library scanner continues automatically since we don't call stop()
          } else {
            // Single-scan mode: stop and fire
            stopScanning();
            onScanSuccessRef.current(qrCode);
          }
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 10,
          preferredCamera: 'environment',
          calculateScanRegion: (video) => {
            const smallerDimension = Math.min(video.videoWidth, video.videoHeight);
            const scanRegionSize = Math.floor(smallerDimension * 0.5);
            return {
              x: Math.floor((video.videoWidth - scanRegionSize) / 2),
              y: Math.floor((video.videoHeight - scanRegionSize) / 2),
              width: scanRegionSize,
              height: scanRegionSize,
              downScaledWidth: scanRegionSize,
              downScaledHeight: scanRegionSize
            };
          }
        }
      );

      scanner.setInversionMode('both');
      scannerRef.current = scanner;

      try {
        await scanner.start();
      } catch {
        await new Promise(resolve => setTimeout(resolve, 500));
        await scanner.start();
      }

      setIsCameraReady(true);
      setIsScanning(true);
      isScanningRef.current = true;
      setScannerType('library');

    } catch (err: any) {
      console.error('Library scanner initialization failed:', err);
      const errorMessage = err.message || 'Failed to initialize scanner';
      setError(errorMessage);
      setIsScanning(false);
      isScanningRef.current = false;
      onScanError?.(errorMessage);
    }
  };

  // Stop scanning and cleanup
  const stopScanning = () => {
    setIsScanning(false);
    isScanningRef.current = false;
    setIsCameraReady(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Manual capture and decode
  const handleManualCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (scannerType === 'native' && 'BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const barcodes = await detector.detect(canvas);

        if (barcodes.length > 0) {
          const qrCode = barcodes[0].rawValue;
          if (!continuous) stopScanning();
          else showScanFlash('Captured!');
          onScanSuccess(qrCode);
          return;
        }
      }

      if (scannerRef.current) {
        const result = await QrScanner.scanImage(canvas, {
          returnDetailedScanResult: true
        });
        if (!continuous) stopScanning();
        else showScanFlash('Captured!');
        onScanSuccess(result.data);
        return;
      }

      onScanError?.('No QR code detected. Try again with better lighting or angle.');

    } catch (err: any) {
      onScanError?.(err.message || 'Failed to decode QR code');
    }
  };

  // Handle manual barcode entry
  const handleManualBarcodeSubmit = () => {
    if (manualBarcode.trim()) {
      if (!continuous) {
        stopScanning();
      } else {
        showScanFlash('Entered!');
      }
      onScanSuccess(manualBarcode.trim());
      setManualBarcode('');
    }
  };

  // Toggle manual entry mode
  const toggleManualEntry = () => {
    setShowManualEntry(!showManualEntry);
    setManualBarcode('');
  };

  // Initialize scanner on mount
  useEffect(() => {
    const initScanner = async () => {
      const hasNativeSupport = await checkBarcodeDetectorSupport();
      if (hasNativeSupport) {
        await initNativeBarcodeScanner();
      } else {
        await initLibraryScanner();
      }
    };

    initScanner();

    return () => {
      stopScanning();
    };
  }, []);

  const handleClose = () => {
    stopScanning();
    onClose?.();
  };

  return (
    <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
      {/* Video element */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {/* Hidden canvas for native BarcodeDetector */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Scan overlay */}
      {isCameraReady && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Dark overlay with transparent center */}
          <div className="absolute inset-0 bg-black/50" />

          {/* Scan box */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="relative w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80">
              {/* Corner markers */}
              <div className="absolute top-0 left-0 w-8 h-8 sm:w-12 sm:h-12 border-t-3 border-l-3 sm:border-t-4 sm:border-l-4 border-green-500" />
              <div className="absolute top-0 right-0 w-8 h-8 sm:w-12 sm:h-12 border-t-3 border-r-3 sm:border-t-4 sm:border-r-4 border-green-500" />
              <div className="absolute bottom-0 left-0 w-8 h-8 sm:w-12 sm:h-12 border-b-3 border-l-3 sm:border-t-4 sm:border-l-4 border-green-500" />
              <div className="absolute bottom-0 right-0 w-8 h-8 sm:w-12 sm:h-12 border-b-3 border-r-3 sm:border-b-4 sm:border-r-4 border-green-500" />

              {/* Scanning line animation */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent animate-scan" />
            </div>
          </div>

          {/* Continuous mode: progress badge */}
          {continuous && matchProgress && (
            <Badge className="absolute top-4 left-4 z-10 bg-black/60 text-white border-none text-xs font-semibold px-3 py-1 pointer-events-none">
              {matchProgress}
            </Badge>
          )}

          {/* Continuous mode: scan flash */}
          {scanFlash && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 bg-emerald-500 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg animate-pulse pointer-events-none">
              {scanFlash}
            </div>
          )}

          {/* Manual capture button */}
          <div className="absolute bottom-3 sm:bottom-6 left-1/2 transform -translate-x-1/2 pointer-events-auto">
            <Button
              onClick={handleManualCapture}
              variant="secondary"
              size="sm"
              className="bg-white/90 hover:bg-white text-black pointer-events-auto shadow-lg"
            >
              📸
            </Button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {!isCameraReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center text-white">
            <Camera className="w-12 h-12 mx-auto mb-4 animate-pulse" />
            <p className="text-lg font-medium">Initializing Camera...</p>
            <p className="text-sm text-gray-300 mt-2">Please allow camera access</p>
          </div>
        </div>
      )}

      {/* Error state with Manual Entry Option */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-4">
          <div className="text-center text-white max-w-md w-full">
            {!showManualEntry ? (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                  <X className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-lg font-medium mb-2">Camera Not Available</p>
                <p className="text-sm text-gray-300 mb-4">{error}</p>
                {!window.isSecureContext && (
                  <div className="mt-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg mb-4">
                    <p className="text-xs text-yellow-200 font-medium">🔒 HTTPS Required</p>
                    <p className="text-xs text-yellow-300 mt-1">
                      Camera only works on HTTPS or localhost
                    </p>
                    <p className="text-xs text-yellow-300 mt-2">
                      Current: {window.location.protocol}//{window.location.host}
                    </p>
                    <p className="text-xs text-yellow-300 mt-2">
                      Use: http://localhost:3000 (laptop) or ngrok HTTPS (phone)
                    </p>
                  </div>
                )}
                <Button
                  onClick={() => setShowManualEntry(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4"
                  size="lg"
                >
                  <Keyboard className="w-5 h-5 mr-2" />
                  Enter Barcode Manually
                </Button>
                <p className="text-xs text-gray-400 mt-4">
                  Can&apos;t access camera? Enter the barcode manually instead
                </p>
              </>
            ) : (
              <div className="bg-white/95 backdrop-blur-sm p-6 rounded-lg">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Enter Barcode</h3>
                <Input
                  type="text"
                  placeholder="Enter or paste barcode..."
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && manualBarcode.trim()) {
                      handleManualBarcodeSubmit();
                    }
                  }}
                  className="text-black text-lg mb-4"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowManualEntry(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleManualBarcodeSubmit}
                    disabled={!manualBarcode.trim()}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    Submit
                  </Button>
                </div>
                <p className="text-xs text-gray-600 text-center mt-3">
                  Type or paste the barcode and press Enter
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Close button */}
      <Button
        onClick={handleClose}
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10 bg-black/50 hover:bg-black/70 text-white pointer-events-auto rounded-full h-8 w-8 sm:h-10 sm:w-10"
      >
        <X className="w-4 h-4 sm:w-5 sm:h-5" />
      </Button>

      {/* Custom CSS for scanning animation */}
      <style jsx>{`
        @keyframes scan {
          0% { top: 0; }
          50% { top: 100%; }
          100% { top: 0; }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
