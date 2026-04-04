import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { RefreshCw } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import api from '../api';

const FaceScanner = ({ mode: initialMode, isRegistered, initialToken, onCaptureSuccess, onCancel }) => {
    const [currentMode, setCurrentMode] = useState(initialMode);
    const [qrToken, setQrToken] = useState(initialToken || null);
    const videoRef = useRef();
    const canvasRef = useRef();
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [status, setStatus] = useState('Initializing models (takes ~5s)...');
    const isProcessingRef = useRef(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const streamRef = useRef(null);
    const scanIntervalRef = useRef(null);

    // Sync ref with state so interval callback always gets latest value
    useEffect(() => {
        isProcessingRef.current = isProcessing;
    }, [isProcessing]);

    useEffect(() => {
        if (currentMode === 'qr-scan') {
            const scanner = new Html5QrcodeScanner('qr-reader', {
                 fps: 10,
                 qrbox: { width: 250, height: 250 }
            });
            scanner.render((decodedText) => {
                // The QR encodes the full URL — extract just the sessionToken param
                let token = decodedText;
                try {
                    const url = new URL(decodedText);
                    const param = url.searchParams.get('sessionToken');
                    if (param) token = param;
                } catch (e) {
                    // Not a URL, use raw text as token
                }
                setQrToken(token);
                scanner.clear().then(() => {
                     setCurrentMode('mark');
                });
            }, (error) => {});
            
            return () => {
                 scanner.clear().catch(e => {});
            }
        }
    }, [currentMode]);

    useEffect(() => {
        if (currentMode === 'qr-scan') return;
        
        if (currentMode === 'register' && isRegistered) {
            return;
        }

        const loadModels = async () => {
            // Use jsDelivr CDN — much more reliable than raw.githubusercontent.com
            const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
            try {
                setStatus('Loading AI face models...');
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                ]);
                setModelsLoaded(true);
                setStatus('Models loaded. Accessing camera...');
                startVideo();
            } catch (err) {
                console.error("Error loading models", err);
                setStatus('Failed to load face-api models. Check internet connection and try again.');
            }
        };
        loadModels();

        return () => {
            stopVideo();
            if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
        };
    }, [currentMode, isRegistered]);

    const startVideo = async () => {
        try {
            let stream;
            // Try multiple constraint combinations for maximum device compatibility
            const constraints = [
                { video: { facingMode: 'user' }, audio: false },
                { video: { facingMode: { ideal: 'user' } }, audio: false },
                { video: true, audio: false }
            ];

            for (const constraint of constraints) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia(constraint);
                    break;
                } catch (e) {
                    console.warn('Constraint failed:', constraint, e.message);
                }
            }

            if (!stream) {
                setStatus('Could not access camera. Please check your browser permissions.');
                return;
            }

            streamRef.current = stream;
            if (videoRef.current) {
                const video = videoRef.current;
                
                // Set ALL iOS-required attributes BEFORE assigning srcObject
                video.setAttribute('autoplay', '');
                video.setAttribute('muted', '');
                video.setAttribute('playsinline', '');
                video.setAttribute('webkit-playsinline', '');
                video.playsInline = true;
                video.muted = true;
                video.srcObject = stream;

                // iOS fires 'loadeddata' more reliably than 'loadedmetadata'
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        // Even on timeout, try to play — sometimes events just don't fire on iOS
                        video.play().then(resolve).catch(reject);
                    }, 5000);

                    const onReady = () => {
                        clearTimeout(timeout);
                        video.removeEventListener('loadeddata', onReady);
                        video.removeEventListener('loadedmetadata', onReady);
                        video.play().then(resolve).catch(reject);
                    };

                    video.addEventListener('loadeddata', onReady);
                    video.addEventListener('loadedmetadata', onReady);

                    // If video already has data (e.g. from cache), fire immediately
                    if (video.readyState >= 2) {
                        onReady();
                    }
                });
                setStatus('Position your face clearly in the screen...');
            }
        } catch (err) {
            console.error("Camera error:", err);
            if (err.name === 'NotAllowedError') {
                setStatus('Camera permission denied. Go to Settings > Safari > Camera and allow access, then reload.');
            } else if (err.name === 'NotFoundError') {
                setStatus('No camera found on this device.');
            } else if (err.name === 'NotReadableError' || err.name === 'AbortError') {
                setStatus('Camera is busy. Close other apps using the camera and try again.');
            } else {
                setStatus('Camera error: ' + err.message + '. Try reloading the page.');
            }
        }
    };

    const stopVideo = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    };

    const handleVideoPlay = () => {
        setStatus('Position your face clearly in the screen...');
        if (!videoRef.current) return;
        const displaySize = { width: videoRef.current.clientWidth, height: videoRef.current.clientHeight };
        
        if (canvasRef.current) {
            faceapi.matchDimensions(canvasRef.current, displaySize);
        }

        // Clear any previous interval
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

        scanIntervalRef.current = setInterval(async () => {
            if (isProcessingRef.current) return;
            if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

            try {
                // inputSize: 416 = detects faces from farther distance (smaller faces in frame)
                // 224 = needs face very close. 320 = medium. 416 = works at arm's length or further.
                const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 });
                const detections = await faceapi.detectSingleFace(videoRef.current, options)
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (detections && canvasRef.current) {
                    const resizedDetections = faceapi.resizeResults(detections, displaySize);
                    const ctx = canvasRef.current.getContext('2d');
                    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                    faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
                    
                    const score = detections.detection.score;
                    setStatus(`Face detected (${Math.round(score * 100)}% confidence)... Hold steady`);

                    // 0.4 threshold — relaxed enough to work at normal distance
                    if (score > 0.4 && !isProcessingRef.current) {
                        isProcessingRef.current = true;
                        setIsProcessing(true);
                        setStatus('Processing Face Data...');
                        processDescriptor(detections.descriptor);
                    }
                } else if (canvasRef.current) {
                    const ctx = canvasRef.current.getContext('2d');
                    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                }
            } catch (err) {
                // Detection can fail if video element is in a bad state — just skip
            }
        }, 500);
    };

    const processDescriptor = async (descriptorFloat32) => {
        const formattedDescriptor = Array.from(descriptorFloat32);
        try {
            if (currentMode === 'register') {
                await api.post('/attendance/register-face', { descriptor: formattedDescriptor });
                setStatus('✅ Face Registered Successfully!');
                stopVideo();
                setTimeout(() => onCaptureSuccess(), 1500);
            } else if (currentMode === 'mark') {
                await api.post('/attendance/mark', { descriptor: formattedDescriptor, sessionToken: qrToken });
                setStatus('✅ Attendance Marked Successfully!');
                stopVideo();
                setTimeout(() => onCaptureSuccess(), 1500);
            }
        } catch (err) {
            setStatus('❌ ' + (err.response?.data?.message || err.message));
            setTimeout(() => {
                isProcessingRef.current = false;
                setIsProcessing(false);
                setStatus('Position your face clearly in the screen...');
            }, 3000);
        }
    };

    if (currentMode === 'qr-scan') {
        return (
             <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem' }}>
                  <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-main)', fontSize: '1.3rem' }}>Scan Physical Room QR</h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Please point your camera at the QR code projected by the professor to authorize this localized session.</p>
                  <div id="qr-reader" style={{ width: '100%', maxWidth: '400px', border: 'none', borderRadius: '12px', overflow: 'hidden', background: 'white' }}></div>
                  <button className="btn-secondary" style={{ marginTop: '2rem' }} onClick={onCancel}>Cancel Authentication</button>
             </div>
        );
    }

    if (currentMode === 'register' && isRegistered) {
        return (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{ marginBottom: '2rem', padding: '2rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', border: '1px solid var(--success)' }}>
                    <h3 style={{ color: 'var(--success)', marginBottom: '1rem', fontSize: '1.4rem' }}>Biometric Identity Secured</h3>
                    <p style={{ color: 'var(--text-main)', fontSize: '1.1rem', margin: 0 }}>
                        Your face is locked permanently to this account. Further updates are disabled by the college security policy.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <button className="btn-secondary" onClick={onCancel}>
                        Return to Portal
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <p style={{ marginBottom: '1rem', color: isProcessing ? 'var(--success)' : 'var(--text-main)', fontWeight: '600', fontSize: '1.1rem' }}>
                {status}
            </p>
            <div className="camera-container" style={{ position: 'relative' }}>
                {modelsLoaded ? (
                    <>
                        <video ref={videoRef} autoPlay muted playsInline onPlay={handleVideoPlay}></video>
                        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
                    </>
                ) : (
                    <div style={{ padding: '6rem 2rem', color: 'var(--text-muted)' }}>
                        <RefreshCw size={40} style={{ animation: 'spin 2s linear infinite', margin: '0 auto 10px', display: 'block' }} />
                        <p>{status}</p>
                        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                    </div>
                )}
            </div>
            <button className="btn-secondary" style={{ marginTop: '1.5rem', width: '200px' }} onClick={() => { stopVideo(); onCancel(); }}>
                Cancel
            </button>
        </div>
    );
};

export default FaceScanner;
