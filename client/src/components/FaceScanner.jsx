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
    const [isProcessing, setIsProcessing] = useState(false);
    const streamRef = useRef(null);
    const scanIntervalRef = useRef(null);

    useEffect(() => {
        if (currentMode === 'qr-scan') {
            const scanner = new Html5QrcodeScanner('qr-reader', {
                 fps: 10,
                 qrbox: { width: 250, height: 250 }
            });
            scanner.render((decodedText) => {
                 setQrToken(decodedText);
                 scanner.clear().then(() => {
                      setCurrentMode('mark'); // Transition to Face Recognition
                 });
            }, (error) => {});
            
            return () => {
                 scanner.clear().catch(e => {});
            }
        }
    }, [currentMode]);

    useEffect(() => {
        if (currentMode === 'qr-scan') return; // Gate: Ensure QR is scanned before loading face models
        
        if (currentMode === 'register' && isRegistered) {
            return; // Permanently lock if registered
        }

        const loadModels = async () => {
            const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
            try {
                // Models fetched from CDN for convenience and saving bandwidth. 
                // Using FaceLandmark68 and FaceRecognition nets.
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
                setStatus('Failed to load face-api models. Check internet connection.');
            }
        };
        loadModels();

        return () => {
            stopVideo();
            if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
        };
    }, [currentMode, isRegistered]);

    const startVideo = () => {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
            .then(stream => {
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            })
            .catch(err => {
                console.error("Camera access denied", err);
                setStatus('Camera access denied. Please grant permission.');
            });
    };

    const stopVideo = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
        }
    };

    const handleVideoPlay = () => {
        setStatus('Position your face clearly in the screen...');
        if (!videoRef.current) return;
        const displaySize = { width: videoRef.current.clientWidth, height: videoRef.current.clientHeight };
        
        if (canvasRef.current) {
            faceapi.matchDimensions(canvasRef.current, displaySize);
        }

        scanIntervalRef.current = setInterval(async () => {
            if (isProcessing) return;

            const detections = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (detections && canvasRef.current) {
                const resizedDetections = faceapi.resizeResults(detections, displaySize);
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
                
                // If detection score is strong, trigger
                if (detections.detection.score > 0.8 && !isProcessing) {
                    setIsProcessing(true);
                    setStatus('Processing Face Data...');
                    processDescriptor(detections.descriptor);
                }
            } else if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
        }, 800);
    };

    const processDescriptor = async (descriptorFloat32) => {
        const formattedDescriptor = Array.from(descriptorFloat32);
        try {
            if (currentMode === 'register') {
                await api.post('/attendance/register-face', { descriptor: formattedDescriptor });
                setStatus('Face Registered Successfully!');
                setTimeout(() => onCaptureSuccess(), 1500);
            } else if (currentMode === 'mark') {
                await api.post('/attendance/mark', { descriptor: formattedDescriptor, sessionToken: qrToken });
                setStatus('Attendance Secured Successfully!');
                setTimeout(() => onCaptureSuccess(), 1500);
            }
        } catch (err) {
            setStatus('Failed: ' + (err.response?.data?.message || err.message));
            setTimeout(() => setIsProcessing(false), 3000);
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
                        <RefreshCw className="animate-spin" size={40} style={{ animation: 'spin 2s linear infinite', margin: '0 auto 10px' }} />
                        <p>Loading AI Models...</p>
                        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                    </div>
                )}
            </div>
            <button className="btn-secondary" style={{ marginTop: '1.5rem', width: '200px' }} onClick={onCancel}>
                Cancel
            </button>
        </div>
    );
};

export default FaceScanner;
