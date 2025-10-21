"use client";

import React, { useRef, useEffect, useState } from 'react';
import QrScanner from 'qr-scanner';
import { Camera, X, Maximize2, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Set worker path for QR Scanner
QrScanner.WORKER_PATH = '/qr-scanner-worker.min.js';

interface HighPerformanceQRScannerProps {
  onScanSuccess: (result: string) => void;
  onScanError?: (error: string) => void;
  onClose?: () => void;
}

export default function HighPerformanceQRScanner({
  onScanSuccess,
  onScanError,
  onClose
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



  // Check if BarcodeDetector API is available
  const checkBarcodeDetectorSupport = async (): Promise<boolean> => {
    if (!('BarcodeDetector' in window)) {
      console.log('📱 BarcodeDetector API not available, will use qr-scanner library');
      return false;
    }

    try {
      const formats = await (window as any).BarcodeDetector.getSupportedFormats();
      const supportsQR = formats.includes('qr_code');
      console.log('✅ BarcodeDetector API available, formats:', formats);
      return supportsQR;
    } catch (err) {
      console.error('❌ Error checking BarcodeDetector support:', err);
      return false;
    }
  };

  // Initialize native BarcodeDetector scanner
  const initNativeBarcodeScanner = async () => {
    try {
      console.log('🚀 Initializing Native BarcodeDetector...');

      // Check if we're on HTTPS or localhost
      const isSecureContext = window.isSecureContext;
      if (!isSecureContext) {
        console.warn('⚠️ Not a secure context. Camera may not work. Use HTTPS or localhost.');
      }

      // Request camera with optimal settings
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 60, min: 30 },
          aspectRatio: { ideal: 16 / 9 }
        }
      });

      if (!videoRef.current) return;

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      
      // Wait for video to be ready
      await new Promise((resolve, reject) => {
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = resolve;
          videoRef.current.onerror = reject;
        }
      });

      // Play video with error handling
      try {
        await videoRef.current.play();
      } catch (playError: any) {
        console.warn('Play error (retrying):', playError.message);
        // Retry after a short delay
        await new Promise(resolve => setTimeout(resolve, 500));
        await videoRef.current.play();
      }

      setIsCameraReady(true);
      setIsScanning(true);
      setScannerType('native');

      // Create BarcodeDetector
      const barcodeDetector = new (window as any).BarcodeDetector({
        formats: ['qr_code']
      });

      console.log('✅ Native BarcodeDetector initialized');

      // Start continuous scanning
      let frameCount = 0;
      const scanFrame = async () => {
        if (!videoRef.current || !canvasRef.current || !isScanning) return;

        try {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          if (!ctx) return;

          // Set canvas size to match video
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            console.log('📐 Canvas size:', canvas.width, 'x', canvas.height);
          }

          // Draw current video frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Detect barcodes
          const barcodes = await barcodeDetector.detect(canvas);

          // Log scanning status every 60 frames (~1 second)
          frameCount++;
          if (frameCount % 60 === 0) {
            console.log('🔍 Scanning... (frame', frameCount, ')');
          }

          if (barcodes.length > 0) {
            const qrCode = barcodes[0].rawValue;
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('✅ QR CODE SCANNED SUCCESSFULLY!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📱 Scanner Type: Native BarcodeDetector API');
            console.log('📦 QR Code Data:', qrCode);
            console.log('📊 Full Barcode Details:', barcodes[0]);
            console.log('⏱️ Timestamp:', new Date().toLocaleTimeString());
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            // Stop scanning
            stopScanning();
            
            // Return result
            onScanSuccess(qrCode);
            return;
          }

          // Continue scanning
          animationFrameRef.current = requestAnimationFrame(scanFrame);
        } catch (err) {
          console.error('❌ Error during native scan:', err);
          animationFrameRef.current = requestAnimationFrame(scanFrame);
        }
      };

      // Start scanning loop
      console.log('🎬 Starting scan loop...');
      scanFrame();

    } catch (err: any) {
      console.error('❌ Native scanner initialization failed:', err);
      setError(err.message || 'Failed to initialize native scanner');
      
      // Fallback to library scanner
      initLibraryScanner();
    }
  };

  // Initialize qr-scanner library as fallback
  const initLibraryScanner = async () => {
    try {
      console.log('🔄 Initializing qr-scanner library fallback...');
      console.log('📍 Current URL:', window.location.href);
      console.log('🔒 Secure context:', window.isSecureContext);

      if (!videoRef.current) {
        throw new Error('Video element not ready');
      }

      // Check if we're on a secure context (HTTPS or localhost)
      if (!window.isSecureContext) {
        throw new Error('Camera requires HTTPS or localhost. Current URL: ' + window.location.protocol + '//' + window.location.host);
      }

      // Check if camera API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available in this browser');
      }

      // Stop any existing streams first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Wait a bit before initializing
      await new Promise(resolve => setTimeout(resolve, 300));

      // Test camera access first
      try {
        console.log('🎥 Testing camera access...');
        const testStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        console.log('✅ Camera access granted!');
        testStream.getTracks().forEach(track => track.stop());
      } catch (permErr: any) {
        console.error('❌ Camera permission denied:', permErr);
        throw new Error('Camera permission denied. Please allow camera access in browser settings.');
      }

      // Create QrScanner instance
      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('✅ QR CODE SCANNED SUCCESSFULLY!');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📱 Scanner Type: qr-scanner Library');
          console.log('📦 QR Code Data:', result.data);
          console.log('📊 Full Result:', result);
          console.log('⏱️ Timestamp:', new Date().toLocaleTimeString());
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          stopScanning();
          onScanSuccess(result.data);
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 10, // Reduced for better accuracy
          preferredCamera: 'environment',
          calculateScanRegion: (video) => {
            // Center scan region (50% of smaller dimension for better focus)
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

      // Add scan event listener for debugging
      scanner.setInversionMode('both'); // Try both normal and inverted

      scannerRef.current = scanner;

      // Start scanning with retry logic
      try {
        console.log('▶️ Starting scanner...');
        await scanner.start();
        console.log('✅ Scanner started successfully!');
      } catch (startError: any) {
        console.warn('⚠️ Scanner start error (retrying):', startError.message);
        await new Promise(resolve => setTimeout(resolve, 500));
        await scanner.start();
      }

      setIsCameraReady(true);
      setIsScanning(true);
      setScannerType('library');

      console.log('✅ qr-scanner library initialized');

    } catch (err: any) {
      console.error('❌ Library scanner initialization failed:', err);
      const errorMessage = err.message || 'Failed to initialize scanner';
      setError(errorMessage);
      setIsScanning(false);
      onScanError?.(errorMessage);
    }
  };

  // Stop scanning and cleanup
  const stopScanning = () => {
    console.log('🛑 Stopping scanner...');
    
    setIsScanning(false);
    setIsCameraReady(false);

    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop qr-scanner library
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }

    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Manual capture and decode
  const handleManualCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      console.log('📸 Manual capture triggered...');
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) return;

      // Set canvas size
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Capture current frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Try native API first
      if (scannerType === 'native' && 'BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const barcodes = await detector.detect(canvas);
        
        if (barcodes.length > 0) {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('✅ QR CODE CAPTURED SUCCESSFULLY! (Manual)');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📱 Scanner Type: Native BarcodeDetector API');
          console.log('📦 QR Code Data:', barcodes[0].rawValue);
          console.log('⏱️ Timestamp:', new Date().toLocaleTimeString());
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          stopScanning();
          onScanSuccess(barcodes[0].rawValue);
          return;
        }
      }

      // Try qr-scanner library
      if (scannerRef.current) {
        const result = await QrScanner.scanImage(canvas, { 
          returnDetailedScanResult: true
        });
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ QR CODE CAPTURED SUCCESSFULLY! (Manual)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📱 Scanner Type: qr-scanner Library');
        console.log('📦 QR Code Data:', result.data);
        console.log('⏱️ Timestamp:', new Date().toLocaleTimeString());
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        stopScanning();
        onScanSuccess(result.data);
        return;
      }

      console.warn('⚠️ No QR code found in captured frame');
      onScanError?.('No QR code detected. Try again with better lighting or angle.');

    } catch (err: any) {
      console.error('❌ Manual capture error:', err);
      onScanError?.(err.message || 'Failed to decode QR code');
    }
  };

  // Handle manual barcode entry
  const handleManualBarcodeSubmit = () => {
    if (manualBarcode.trim()) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ BARCODE ENTERED MANUALLY!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('⌨️ Input Method: Manual Entry');
      console.log('📦 Barcode Data:', manualBarcode.trim());
      console.log('⏱️ Timestamp:', new Date().toLocaleTimeString());
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      stopScanning();
      onScanSuccess(manualBarcode.trim());
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
      // Check if native API is available
      const hasNativeSupport = await checkBarcodeDetectorSupport();
      
      if (hasNativeSupport) {
        await initNativeBarcodeScanner();
      } else {
        await initLibraryScanner();
      }
    };

    initScanner();

    // Cleanup on unmount
    return () => {
      stopScanning();
    };
  }, []);

  const handleClose = () => {
    stopScanning();
    onClose?.();
  };

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {/* Hidden canvas for native BarcodeDetector */}
      <canvas
        ref={canvasRef}
        className="hidden"
      />

      {/* Scan overlay */}
      {isCameraReady && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Dark overlay with transparent center */}
          <div className="absolute inset-0 bg-black/50" />
          
          {/* Scan box */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="relative w-64 h-64 md:w-80 md:h-80">
              {/* Corner markers */}
              <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-green-500" />
              <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-green-500" />
              <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-green-500" />
              <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-green-500" />
              
              {/* Scanning line animation */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent animate-scan" />
            </div>
          </div>

          {/* Manual capture button - minimalist */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 pointer-events-auto">
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
                      ✅ Use: http://localhost:3000 (laptop) or ngrok HTTPS (phone)
                    </p>
                  </div>
                )}
                
                {/* Manual Entry Option Button */}
                <Button
                  onClick={() => setShowManualEntry(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4"
                  size="lg"
                >
                  <Keyboard className="w-5 h-5 mr-2" />
                  Enter Barcode Manually
                </Button>
                
                <p className="text-xs text-gray-400 mt-4">
                  Can't access camera? Enter the barcode manually instead
                </p>
              </>
            ) : (
              <>
                {/* Manual Entry Form */}
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
              </>
            )}
          </div>
        </div>
      )}

      {/* Close button */}
      <Button
        onClick={handleClose}
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white pointer-events-auto rounded-full"
      >
        <X className="w-5 h-5" />
      </Button>

      {/* Custom CSS for scanning animation */}
      <style jsx>{`
        @keyframes scan {
          0% {
            top: 0;
          }
          50% {
            top: 100%;
          }
          100% {
            top: 0;
          }
        }
        
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
