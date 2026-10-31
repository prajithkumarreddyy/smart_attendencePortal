import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as faceapi from 'face-api.js';
import { 
    ShieldAlert, AlertTriangle, Volume2, VolumeX, Eye, 
    RefreshCw, Camera, Users, CheckCircle, XCircle, Download, Trash2, 
    UserCheck, UserX, Search, Filter, Play, Square, Award, Sliders
} from 'lucide-react';
import api from '../api';

// Euclidean distance between two face descriptors (using faceapi's native method if available)
const euclideanDistance = (desc1, desc2) => {
    if (!desc1 || !desc2) return Infinity;
    if (typeof faceapi !== 'undefined' && faceapi.euclideanDistance) {
        return faceapi.euclideanDistance(desc1, desc2);
    }
    const d1 = Array.from(desc1);
    const d2 = Array.from(desc2);
    if (d1.length !== 128 || d2.length !== 128) return Infinity;
    return Math.sqrt(d1.reduce((sum, val, i) => sum + Math.pow(val - (d2[i] || 0), 2), 0));
};

// Natural / numeric roll number range check
const isRollInRange = (roll, fromRoll, toRoll) => {
    if (!roll) return false;
    const cleanRoll = String(roll).trim();
    const cleanFrom = String(fromRoll).trim();
    const cleanTo = String(toRoll).trim();

    if (!cleanFrom && !cleanTo) return true; // No range filter active

    // If all are numeric strings, compare as BigInt/Numbers
    const isNumRoll = /^\d+$/.test(cleanRoll);
    const isNumFrom = /^\d+$/.test(cleanFrom);
    const isNumTo = /^\d+$/.test(cleanTo);

    if (isNumRoll && (!cleanFrom || isNumFrom) && (!cleanTo || isNumTo)) {
        const val = BigInt(cleanRoll);
        const from = cleanFrom ? BigInt(cleanFrom) : -Infinity;
        const to = cleanTo ? BigInt(cleanTo) : Infinity;
        return val >= from && val <= to;
    }

    // Alphanumeric fallback (lexicographical)
    const matchFrom = !cleanFrom || cleanRoll.localeCompare(cleanFrom, undefined, { numeric: true }) >= 0;
    const matchTo = !cleanTo || cleanRoll.localeCompare(cleanTo, undefined, { numeric: true }) <= 0;
    return matchFrom && matchTo;
};

// Standard exam room series: K - 001 to K - 014, K - 101 to K - 114, up to K - 414
const EXAM_ROOM_SERIES = [
    { floor: 'Ground Floor (0 Series: K-001 to K-014)', rooms: Array.from({ length: 14 }, (_, i) => `K - ${String(i + 1).padStart(3, '0')}`) },
    { floor: '1st Floor (100 Series: K-101 to K-114)', rooms: Array.from({ length: 14 }, (_, i) => `K - ${101 + i}`) },
    { floor: '2nd Floor (200 Series: K-201 to K-214)', rooms: Array.from({ length: 14 }, (_, i) => `K - ${201 + i}`) },
    { floor: '3rd Floor (300 Series: K-301 to K-314)', rooms: Array.from({ length: 14 }, (_, i) => `K - ${301 + i}`) },
    { floor: '4th Floor (400 Series: K-401 to K-414)', rooms: Array.from({ length: 14 }, (_, i) => `K - ${401 + i}`) }
];

const ExamProctoring = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const scanIntervalRef = useRef(null);
    const audioCtxRef = useRef(null);
    const lastAlertTimeRef = useRef(0);
    const lastSnapshotTimeRef = useRef(0);

    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [allStudents, setAllStudents] = useState([]);
    const [isSyncing, setIsSyncing] = useState(false);
    
    // Range Configuration
    const [fromRoll, setFromRoll] = useState('2320030001');
    const [toRoll, setToRoll] = useState('2320030500');
    const [examHall, setExamHall] = useState('K - 101');
    const [threshold, setThreshold] = useState(0.60); // 0.60 is standard face-api matcher distance threshold
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [statusMessage, setStatusMessage] = useState('Initializing AI surveillance models...');
    const [availableCameras, setAvailableCameras] = useState([]);
    const [selectedCameraId, setSelectedCameraId] = useState('');

    // Active Tab under Monitor
    const [activeRosterTab, setActiveRosterTab] = useState('absent'); // 'absent' | 'present' | 'incidents' | 'all'
    const [searchQuery, setSearchQuery] = useState('');

    // Real-time Attendance & Telemetry State
    const [presentMap, setPresentMap] = useState({}); // { [studentId]: { student, detectedAt, confidence } }
    const [currentStatus, setCurrentStatus] = useState('STANDBY'); // 'VERIFIED' | 'OUT_OF_RANGE' | 'UNKNOWN' | 'MULTIPLE' | 'STANDBY'
    const [fps, setFps] = useState(0);
    const [cctvTime, setCctvTime] = useState(new Date().toLocaleTimeString());
    const [activeAlert, setActiveAlert] = useState(null);
    const [incidents, setIncidents] = useState([]);
    const [selectedSnapshot, setSelectedSnapshot] = useState(null);

    // Refs to avoid React closure staleness inside scanInterval
    const allStudentsRef = useRef(allStudents);
    const fromRollRef = useRef(fromRoll);
    const toRollRef = useRef(toRoll);
    const thresholdRef = useRef(threshold);

    useEffect(() => {
        allStudentsRef.current = allStudents;
    }, [allStudents]);

    useEffect(() => {
        fromRollRef.current = fromRoll;
    }, [fromRoll]);

    useEffect(() => {
        toRollRef.current = toRoll;
    }, [toRoll]);

    useEffect(() => {
        thresholdRef.current = threshold;
    }, [threshold]);

    // Audio Siren Synthesizer using Web Audio API
    const playSecuritySiren = useCallback(() => {
        if (!soundEnabled) return;
        const now = Date.now();
        if (now - lastAlertTimeRef.current < 1200) return;
        lastAlertTimeRef.current = now;

        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = audioCtxRef.current;
            if (ctx.state === 'suspended') ctx.resume();

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.6);

            gain.gain.setValueAtTime(0.18, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.6);
        } catch (e) {
            console.warn('Audio alert error:', e);
        }
    }, [soundEnabled]);

    // Live Clock
    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            setCctvTime(`${now.toISOString().split('T')[0]} ${now.toTimeString().split(' ')[0]}.${String(now.getMilliseconds()).padStart(3, '0')}`);
        }, 100);
        return () => clearInterval(timer);
    }, []);

    // Fetch registered students (directly from attendance database)
    const fetchStudents = useCallback(async (silent = false) => {
        if (!silent) setIsSyncing(true);
        try {
            const res = await api.get('/admin/exam-students');
            const data = res.data || [];
            setAllStudents(data);

            // Auto-set sensible from/to defaults based on loaded students on initial load
            if (data.length > 0) {
                setFromRoll(prev => {
                    if (prev && prev !== '2320030001') return prev;
                    const sorted = [...data].sort((a, b) => String(a.rollNumber).localeCompare(String(b.rollNumber), undefined, { numeric: true }));
                    return String(sorted[0].rollNumber);
                });
                setToRoll(prev => {
                    if (prev && prev !== '2320030500') return prev;
                    const sorted = [...data].sort((a, b) => String(a.rollNumber).localeCompare(String(b.rollNumber), undefined, { numeric: true }));
                    return String(sorted[sorted.length - 1].rollNumber);
                });
            }
        } catch (err) {
            console.error('Failed to load students:', err);
            if (!silent) setStatusMessage('Failed to fetch attendance student database.');
        } finally {
            if (!silent) setIsSyncing(false);
        }
    }, []);

    // Initial fetch + continuous background sync every 6 seconds to capture newly registered attendance faces
    useEffect(() => {
        fetchStudents(false);
        const pollTimer = setInterval(() => {
            fetchStudents(true);
        }, 6000);
        return () => clearInterval(pollTimer);
    }, [fetchStudents]);

    // Camera list
    useEffect(() => {
        const getDevices = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoInputs = devices.filter(d => d.kind === 'videoinput');
                setAvailableCameras(videoInputs);
                if (videoInputs.length > 0 && !selectedCameraId) {
                    setSelectedCameraId(videoInputs[0].deviceId);
                }
            } catch (err) {
                console.warn('Could not enumerate cameras:', err);
            }
        };
        getDevices();
    }, []);

    // Load Face-API neural models
    useEffect(() => {
        const loadModels = async () => {
            const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
            try {
                setStatusMessage('Loading AI face neural weights for surveillance...');
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
                ]);
                setModelsLoaded(true);
                setStatusMessage(`AI Neural Models Active. Auto-starting CCTV feed for Room ${examHall}...`);
                // Auto-start surveillance immediately without pressing start
                startCamera(selectedCameraId, examHall);
            } catch (err) {
                console.error('Model loading error:', err);
                setStatusMessage('Failed to load neural models. Check internet connection.');
            }
        };
        loadModels();

        return () => {
            stopCamera();
            if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
        };
    }, []);

    // Auto-launch CCTV surveillance as soon as models and devices are ready
    useEffect(() => {
        if (modelsLoaded && !cameraActive && !streamRef.current) {
            startCamera(selectedCameraId, examHall);
        }
    }, [modelsLoaded, selectedCameraId]);

    // Count of students who have registered face in regular attendance
    const attendanceRegisteredStudents = useMemo(() => {
        return allStudents.filter(s => s.registeredFace && s.faceDescriptor && s.faceDescriptor.length === 128);
    }, [allStudents]);

    // Filter students by current Roll Number range
    const rangeStudents = useMemo(() => {
        return allStudents.filter(s => isRollInRange(s.rollNumber, fromRoll, toRoll));
    }, [allStudents, fromRoll, toRoll]);

    // Compute present vs absent candidates
    const presentStudentsList = useMemo(() => {
        return Object.values(presentMap).sort((a, b) => String(a.student.rollNumber).localeCompare(String(b.student.rollNumber), undefined, { numeric: true }));
    }, [presentMap]);

    const absentStudentsList = useMemo(() => {
        return rangeStudents.filter(s => !presentMap[s._id]).sort((a, b) => String(a.rollNumber).localeCompare(String(b.rollNumber), undefined, { numeric: true }));
    }, [rangeStudents, presentMap]);

    // Start CCTV Feed
    const startCamera = async (deviceId, roomName) => {
        const currentRoom = roomName || examHall;
        stopCamera();
        try {
            const constraints = {
                video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.setAttribute('playsinline', '');
                videoRef.current.muted = true;
                await videoRef.current.play();
                setCameraActive(true);
                setStatusMessage(`● CCTV FEED ONLINE — ROOM ${currentRoom} (Matching attendance faces)`);
            }
        } catch (err) {
            console.error('Camera startup error:', err);
            setStatusMessage('Camera error: ' + err.message);
        }
    };

    // Selecting a room directly switches & shows the CCTV feed for that room.
    // Roll number range is cleared so the invigilator enters the correct cohort for the new room.
    const handleRoomChange = async (newRoom) => {
        setExamHall(newRoom);

        // ── Reset cohort range — must be re-entered for the new room ──
        setFromRoll('');
        setToRoll('');

        // ── Clear the previous room's exam session data ──
        setPresentMap({});
        setActiveAlert(null);
        setIncidents([]);

        let targetCamId = selectedCameraId;
        if (availableCameras.length > 0) {
            let hash = 0;
            for (let i = 0; i < newRoom.length; i++) hash += newRoom.charCodeAt(i);
            const camIndex = hash % availableCameras.length;
            targetCamId = availableCameras[camIndex].deviceId;
            setSelectedCameraId(targetCamId);
        }

        if (modelsLoaded) {
            await startCamera(targetCamId, newRoom);
        }
    };

    const stopCamera = () => {
        if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);
        setCurrentStatus('STANDBY');
    };

    // Capture snapshot for breach audit
    const captureIncidentSnapshot = (reason, studentObj, detectedName, confidence) => {
        const now = Date.now();
        if (now - lastSnapshotTimeRef.current < 3000) return;
        lastSnapshotTimeRef.current = now;

        if (!videoRef.current) return;
        try {
            const snapCanvas = document.createElement('canvas');
            snapCanvas.width = videoRef.current.videoWidth || 640;
            snapCanvas.height = videoRef.current.videoHeight || 480;
            const ctx = snapCanvas.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0, snapCanvas.width, snapCanvas.height);

            // Watermark banner
            ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
            ctx.fillRect(0, 0, snapCanvas.width, 42);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 15px monospace';
            ctx.fillText(`🚨 EXAM RANGE BREACH: ${reason.toUpperCase()} | ${new Date().toLocaleTimeString()} | Hall: ${examHall}`, 15, 26);

            const snapshotUrl = snapCanvas.toDataURL('image/jpeg', 0.8);
            const newIncident = {
                id: `BREACH-${Date.now().toString().slice(-6)}`,
                timestamp: new Date().toLocaleTimeString(),
                date: new Date().toLocaleDateString(),
                type: reason,
                detectedName: detectedName,
                assignedRange: `${fromRollRef.current} to ${toRollRef.current}`,
                confidence: confidence ? `${confidence}%` : 'N/A',
                snapshot: snapshotUrl,
                status: 'FLAGGED'
            };

            setIncidents(prev => [newIncident, ...prev].slice(0, 50));
        } catch (e) {
            console.error('Snapshot capture error:', e);
        }
    };

    // Continuous CCTV AI Detection Loop
    const handleVideoPlay = () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;

        let frameCount = 0;
        let lastFpsTimestamp = performance.now();

        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

        scanIntervalRef.current = setInterval(async () => {
            if (!video || video.paused || video.ended) return;

            // Calculate FPS
            frameCount++;
            const now = performance.now();
            if (now - lastFpsTimestamp >= 1000) {
                setFps(Math.round((frameCount * 1000) / (now - lastFpsTimestamp)));
                frameCount = 0;
                lastFpsTimestamp = now;
            }

            try {
                const displaySize = { width: video.clientWidth, height: video.clientHeight };
                if (canvas) faceapi.matchDimensions(canvas, displaySize);

                // Score threshold 0.28 ensures reliable detection at desk/classroom distances
                const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.28 });
                const detections = await faceapi.detectAllFaces(video, detectorOptions)
                    .withFaceLandmarks()
                    .withFaceDescriptors();

                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const resizedDetections = faceapi.resizeResults(detections, displaySize);

                if (detections.length === 0) {
                    return;
                }

                // Multiple Persons warning
                if (detections.length > 1) {
                    playSecuritySiren();
                    setActiveAlert({
                        type: 'warning',
                        title: '⚠️ MULTIPLE PERSONS DETECTED IN CCTV FRAME',
                        detail: `Identified ${detections.length} persons simultaneously. Verify exam desk isolation.`
                    });
                }

                // Use latest values from refs to prevent closure staleness
                const currentStudents = allStudentsRef.current;
                const currentFrom = fromRollRef.current;
                const currentTo = toRollRef.current;
                const currentThreshold = thresholdRef.current;

                // Process each face in frame
                resizedDetections.forEach((det, i) => {
                    const box = det.detection.box;
                    const descriptor = detections[i].descriptor;

                    let matchedStudent = null;
                    let bestDistance = Infinity;

                    // Match against actual faces registered for attendance
                    for (let s of currentStudents) {
                        if (s.registeredFace && s.faceDescriptor && s.faceDescriptor.length === 128) {
                            const dist = euclideanDistance(descriptor, s.faceDescriptor);
                            if (dist < bestDistance) {
                                bestDistance = dist;
                                if (dist <= currentThreshold) {
                                    matchedStudent = s;
                                }
                            }
                        }
                    }

                    const confidenceScore = Math.max(0, Math.min(100, Math.round((1 - bestDistance) * 100)));

                    if (matchedStudent) {
                        // Check if this student is WITHIN the specified Roll Number range [fromRoll, toRoll]
                        const inRange = isRollInRange(matchedStudent.rollNumber, currentFrom, currentTo);

                        if (inRange) {
                            // ✅ AUTHORIZED CANDIDATE IN RANGE (MATCHED WITH ACTUAL ATTENDANCE FACE)!
                            setCurrentStatus('VERIFIED');
                            
                            // Mark student present in exam state
                            setPresentMap(prev => {
                                if (!prev[matchedStudent._id]) {
                                    return {
                                        ...prev,
                                        [matchedStudent._id]: {
                                            student: matchedStudent,
                                            detectedAt: new Date().toLocaleTimeString(),
                                            confidence: confidenceScore
                                        }
                                    };
                                }
                                return prev;
                            });

                            drawHighTechBox(
                                ctx, box, '#10b981', 
                                `✓ ATTENDANCE FACE VERIFIED`, 
                                `${matchedStudent.name} (${matchedStudent.rollNumber}) • Match ${confidenceScore}%`
                            );
                        } else {
                            // 🚨 OUT OF RANGE STUDENT (WRONG HALL / DUPLICATE / PROXY)!
                            setCurrentStatus('OUT_OF_RANGE');
                            playSecuritySiren();

                            const alertText = `Candidate ${matchedStudent.name} (${matchedStudent.rollNumber}) recognized via attendance face, but assigned hall range is ${currentFrom} to ${currentTo}!`;
                            
                            setActiveAlert({
                                type: 'danger',
                                title: `🚨 UNAUTHORIZED CANDIDATE: ROLL ${matchedStudent.rollNumber} (OUT OF COHORT)`,
                                detail: alertText
                            });

                            captureIncidentSnapshot('Out-of-Range Student', matchedStudent, `${matchedStudent.name} (${matchedStudent.rollNumber})`, confidenceScore);

                            drawHighTechBox(
                                ctx, box, '#ef4444', 
                                `🚨 WRONG CANDIDATE (OUT OF COHORT)`, 
                                `${matchedStudent.name} (${matchedStudent.rollNumber}) ❌ NOT IN RANGE`
                            );
                        }
                    } else {
                        // 🚨 UNKNOWN STRANGER / NOT REGISTERED IN ATTENDANCE
                        setCurrentStatus('UNKNOWN');
                        playSecuritySiren();

                        setActiveAlert({
                            type: 'danger',
                            title: `🚨 UNIDENTIFIED INDIVIDUAL IN EXAM HALL`,
                            detail: `This face does not match any student registered in the attendance database.`
                        });

                        captureIncidentSnapshot('Unregistered Person', null, 'Unknown Stranger', null);

                        drawHighTechBox(
                            ctx, box, '#ef4444', 
                            `🚨 UNIDENTIFIED PERSON`, 
                            `No Attendance Face Match`
                        );
                    }
                });

            } catch (err) {
                // Ignore transient frame errors
            }
        }, 300);
    };

    // Draw high-tech CCTV bounding box with text
    const drawHighTechBox = (ctx, box, color, title, subtitle) => {
        const { x, y, width, height } = box;
        const cornerLen = Math.min(width, height) * 0.22;

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;

        // Corners
        ctx.beginPath();
        ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + width - cornerLen, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + cornerLen);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, y + height - cornerLen); ctx.lineTo(x, y + height); ctx.lineTo(x + cornerLen, y + height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + width - cornerLen, y + height); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width, y + height - cornerLen);
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Label Badge
        ctx.fillStyle = color === '#ef4444' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)';
        const tagHeight = 36;
        ctx.fillRect(x, Math.max(0, y - tagHeight), width, tagHeight);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(title, x + 8, Math.max(0, y - tagHeight) + 16);
        ctx.font = '10px monospace';
        ctx.fillText(subtitle, x + 8, Math.max(0, y - tagHeight) + 30);
    };

    // Manual Mark Present by Invigilator
    const handleManualMark = (student) => {
        setPresentMap(prev => ({
            ...prev,
            [student._id]: {
                student,
                detectedAt: `${new Date().toLocaleTimeString()} (Manual ID Verified)`,
                confidence: 100
            }
        }));
    };

    // Export Absentees list to CSV
    const exportAbsenteesCSV = () => {
        if (absentStudentsList.length === 0) {
            alert('All students in the specified range are present! Zero absentees.');
            return;
        }
        let csv = 'Roll Number,Student Name,Email,Attendance Face Registered,Status\n';
        absentStudentsList.forEach(s => {
            csv += `"${s.rollNumber}","${s.name}","${s.email || ''}","${s.registeredFace ? 'Yes' : 'No'}","ABSENT / MISSING"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Exam_Absentees_Report_${fromRoll}_to_${toRoll}.csv`;
        a.click();
    };

    // Export Complete Exam Report
    const exportFullReportCSV = () => {
        let csv = 'Roll Number,Student Name,Assigned Range,Attendance Status,Verified Time,Attendance Face Match\n';
        rangeStudents.forEach(s => {
            const isPresent = !!presentMap[s._id];
            const pInfo = presentMap[s._id];
            csv += `"${s.rollNumber}","${s.name}","${fromRoll} - ${toRoll}","${isPresent ? 'PRESENT' : 'ABSENT'}","${isPresent ? pInfo.detectedAt : '-'}","${isPresent ? pInfo.confidence + '%' : '-'}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Exam_Hall_Full_Roster_${examHall.replace(/\s+/g, '_')}_${Date.now()}.csv`;
        a.click();
    };

    // Reset current exam session present roster
    const resetExamSession = () => {
        if (window.confirm('Are you sure you want to reset the current exam attendance roster?')) {
            setPresentMap({});
            setIncidents([]);
            setActiveAlert(null);
        }
    };

    // Auto preset min/max range
    const handleSetFullDatabaseRange = () => {
        if (allStudents.length === 0) return;
        const sorted = [...allStudents].sort((a, b) => String(a.rollNumber).localeCompare(String(b.rollNumber), undefined, { numeric: true }));
        setFromRoll(String(sorted[0].rollNumber));
        setToRoll(String(sorted[sorted.length - 1].rollNumber));
    };

    return (
        <div className="exam-proctoring-container animate-fadeIn">
            
            {/* ── Top Control Header ── */}
            <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
                {/* Row 1: Title + action buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ 
                            width: '42px', height: '42px',
                            background: currentStatus === 'OUT_OF_RANGE' || currentStatus === 'UNKNOWN' ? 'rgba(248, 81, 73, 0.15)' : 'rgba(63, 185, 80, 0.12)', 
                            borderRadius: '10px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <ShieldAlert size={22} color={currentStatus === 'OUT_OF_RANGE' || currentStatus === 'UNKNOWN' ? '#F85149' : '#3FB950'} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', letterSpacing: '-0.01em', color: '#E6EDF3' }}>
                                AI Exam Invigilation
                            </h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                                <span style={{ 
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    padding: '2px 8px', borderRadius: '100px', fontSize: '0.73rem', fontWeight: '600',
                                    background: 'rgba(63, 185, 80, 0.12)', color: '#3FB950'
                                }}>
                                    <CheckCircle size={11} /> {attendanceRegisteredStudents.length}/{allStudents.length} Faces Loaded
                                </span>
                                <span style={{ fontSize: '0.78rem', color: '#8B949E' }}>
                                    Auto-matched from attendance — no re-enrolment needed
                                </span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button 
                            className="btn-secondary" 
                            onClick={() => fetchStudents(false)}
                            disabled={isSyncing}
                            title="Sync newly registered attendance faces"
                        >
                            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                            {isSyncing ? 'Syncing…' : 'Sync Faces'}
                        </button>

                        <button 
                            className="btn-secondary" 
                            onClick={() => setSoundEnabled(!soundEnabled)}
                            title={soundEnabled ? 'Disable siren alerts' : 'Enable siren alerts'}
                        >
                            {soundEnabled ? <Volume2 size={14} color="#F85149" /> : <VolumeX size={14} color="#8B949E" />}
                            {soundEnabled ? 'Siren ON' : 'Siren OFF'}
                        </button>

                        <button 
                            className="btn-secondary" 
                            onClick={resetExamSession}
                        >
                            <Square size={13} /> Reset
                        </button>

                        {/* Live status pill */}
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '7px 14px', borderRadius: '100px',
                            background: cameraActive ? 'rgba(63, 185, 80, 0.12)' : 'rgba(79, 142, 247, 0.12)',
                            border: cameraActive ? '1px solid rgba(63, 185, 80, 0.3)' : '1px solid rgba(79, 142, 247, 0.3)',
                            color: cameraActive ? '#3FB950' : '#4F8EF7',
                            fontWeight: '600', fontSize: '0.8rem',
                        }}>
                            <span style={{
                                width: '7px', height: '7px', borderRadius: '50%',
                                background: cameraActive ? '#3FB950' : '#D29922',
                                boxShadow: cameraActive ? '0 0 6px #3FB950' : '0 0 6px #D29922',
                                animation: 'pulse 1.5s infinite'
                            }}></span>
                            {cameraActive ? `LIVE · ${examHall}` : 'Connecting…'}
                        </div>
                    </div>
                </div>

                {/* Row 2: Config inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(48, 57, 76, 0.8)' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: '#8B949E', marginBottom: '5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            From Roll
                        </label>
                        <input 
                            type="text"
                            className="input-field"
                            value={fromRoll}
                            onChange={e => setFromRoll(e.target.value)}
                            placeholder="e.g. 2320030001"
                            style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: '600', fontSize: '0.9rem' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: '#8B949E', marginBottom: '5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            To Roll
                        </label>
                        <input 
                            type="text"
                            className="input-field"
                            value={toRoll}
                            onChange={e => setToRoll(e.target.value)}
                            placeholder="e.g. 2320030500"
                            style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: '600', fontSize: '0.9rem' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: '#8B949E', marginBottom: '5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            Exam Room · CCTV
                            {cameraActive && <span style={{ color: '#3FB950', marginLeft: '6px' }}>● LIVE</span>}
                        </label>
                        <select 
                            className="input-field"
                            value={examHall}
                            onChange={e => handleRoomChange(e.target.value)}
                            style={{ fontWeight: '600', borderColor: 'rgba(79, 142, 247, 0.4)' }}
                            title="Select room to view its CCTV feed directly"
                        >
                            {EXAM_ROOM_SERIES.map(series => (
                                <optgroup key={series.floor} label={series.floor}>
                                    {series.rooms.map(room => (
                                        <option key={room} value={room}>{room}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Row 3: Quick helpers */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: '#4B5563', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Presets:</span>
                    <button 
                        className="btn-secondary" 
                        onClick={handleSetFullDatabaseRange}
                        style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    >
                        All Enrolled ({allStudents.length})
                    </button>
                    <button 
                        className="btn-secondary" 
                        onClick={() => { setFromRoll(''); setToRoll(''); }}
                        style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    >
                        No Range Lock
                    </button>
                    <span style={{ fontSize: '0.8rem', color: '#8B949E', marginLeft: 'auto' }}>
                        <strong style={{ color: '#E6EDF3' }}>{rangeStudents.length}</strong> candidates in cohort
                    </span>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(79, 142, 247, 0.12)' }}>
                        <Users size={18} color="#4F8EF7" />
                    </div>
                    <div>
                        <div className="stat-value" style={{ color: '#4F8EF7' }}>{rangeStudents.length}</div>
                        <div className="stat-label">Cohort Size</div>
                        <div style={{ fontSize: '0.7rem', color: '#4B5563', marginTop: '2px', fontFamily: 'monospace' }}>{fromRoll || 'All'} – {toRoll || 'All'}</div>
                    </div>
                </div>

                <div className="stat-card" style={{ borderLeft: '2px solid rgba(63, 185, 80, 0.5)' }}>
                    <div className="stat-icon" style={{ background: 'rgba(63, 185, 80, 0.12)' }}>
                        <UserCheck size={18} color="#3FB950" />
                    </div>
                    <div>
                        <div className="stat-value" style={{ color: '#3FB950' }}>{presentStudentsList.length}</div>
                        <div className="stat-label">Verified Present</div>
                    </div>
                </div>

                <div className="stat-card" style={{ borderLeft: '2px solid rgba(248, 81, 73, 0.5)' }}>
                    <div className="stat-icon" style={{ background: 'rgba(248, 81, 73, 0.12)' }}>
                        <UserX size={18} color="#F85149" />
                    </div>
                    <div>
                        <div className="stat-value" style={{ color: '#F85149' }}>{absentStudentsList.length}</div>
                        <div className="stat-label">Missing / Absent</div>
                    </div>
                </div>

                <div className="stat-card" style={{ borderLeft: incidents.length > 0 ? '2px solid rgba(210, 153, 34, 0.6)' : '2px solid transparent' }}>
                    <div className="stat-icon" style={{ background: 'rgba(210, 153, 34, 0.12)' }}>
                        <AlertTriangle size={18} color="#D29922" />
                    </div>
                    <div>
                        <div className="stat-value" style={{ color: incidents.length > 0 ? '#D29922' : '#E6EDF3' }}>{incidents.length}</div>
                        <div className="stat-label">Security Flags</div>
                    </div>
                </div>
            </div>

            {/* Active Security Threat Banner */}
            {activeAlert && (
                <div style={{
                    padding: '1rem 1.25rem',
                    borderRadius: '12px',
                    background: activeAlert.type === 'danger' ? 'rgba(248, 81, 73, 0.12)' : 'rgba(210, 153, 34, 0.1)',
                    border: activeAlert.type === 'danger' ? '1px solid rgba(248, 81, 73, 0.4)' : '1px solid rgba(210, 153, 34, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <AlertTriangle size={22} color={activeAlert.type === 'danger' ? '#F85149' : '#D29922'} style={{ flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontWeight: '700', fontSize: '0.9rem', color: activeAlert.type === 'danger' ? '#F85149' : '#D29922' }}>
                                {activeAlert.title}
                            </p>
                            <p style={{ margin: '2px 0 0 0', color: '#CBD5E1', fontSize: '0.85rem', lineHeight: '1.4' }}>
                                {activeAlert.detail}
                            </p>
                        </div>
                    </div>
                    <button 
                        className="btn-secondary" 
                        onClick={() => setActiveAlert(null)}
                        style={{ fontSize: '0.8rem', padding: '5px 12px', flexShrink: 0 }}
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* CCTV Monitor Frame */}
            <div style={{ 
                overflow: 'hidden', 
                background: '#080C12', 
                border: currentStatus === 'OUT_OF_RANGE' || currentStatus === 'UNKNOWN' ? '1px solid rgba(248,81,73,0.5)' : '1px solid rgba(48, 57, 76, 0.8)',
                boxShadow: currentStatus === 'OUT_OF_RANGE' || currentStatus === 'UNKNOWN' ? '0 0 30px rgba(248, 81, 73, 0.15)' : '0 8px 32px rgba(0,0,0,0.6)',
                position: 'relative',
                borderRadius: '16px',
            }}>
                {/* CCTV Top Overlay HUD */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    padding: '12px 20px',
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    zIndex: 10,
                    color: '#ffffff',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ 
                            width: '10px', height: '10px', borderRadius: '50%', 
                            background: cameraActive ? '#ef4444' : '#64748b', 
                            animation: cameraActive ? 'pulse 1.5s infinite' : 'none' 
                        }}></div>
                        <span style={{ fontWeight: 'bold', letterSpacing: '1px' }}>
                            {cameraActive ? '● REC [CCTV LIVE]' : '○ STANDBY'}
                        </span>
                        <span style={{ color: '#94a3b8' }}>| {examHall}</span>
                        <span style={{ color: '#38bdf8' }}>| RANGE: {fromRoll || 'MIN'} - {toRoll || 'MAX'}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ color: '#38bdf8' }}>FPS: {fps}</span>
                        <span style={{ 
                            padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.75rem',
                            background: currentStatus === 'VERIFIED' ? '#10b981' : currentStatus === 'OUT_OF_RANGE' || currentStatus === 'UNKNOWN' ? '#ef4444' : '#64748b',
                            color: '#ffffff'
                        }}>
                            {currentStatus}
                        </span>
                        <span style={{ color: '#cbd5e1' }}>{cctvTime}</span>
                    </div>
                </div>

                {/* CCTV Video Monitor Canvas */}
                <div style={{ position: 'relative', width: '100%', minHeight: '480px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#090d16' }}>
                    {cameraActive ? (
                        <>
                            <video 
                                ref={videoRef} 
                                autoPlay 
                                muted 
                                playsInline 
                                onPlay={handleVideoPlay}
                                style={{ width: '100%', maxHeight: '680px', objectFit: 'contain', display: 'block' }}
                            />
                            <canvas 
                                ref={canvasRef} 
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                            />
                            <div style={{
                                position: 'absolute', inset: 0, pointerEvents: 'none',
                                background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)',
                                backgroundSize: '100% 4px',
                                opacity: 0.35
                            }}></div>
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '5rem 2rem', color: '#64748b' }}>
                            <Camera size={56} className="animate-pulse" style={{ margin: '0 auto 1rem auto', display: 'block', color: 'var(--primary)', opacity: 0.8 }} />
                            <h3 style={{ color: '#cbd5e1', marginBottom: '0.5rem' }}>
                                {modelsLoaded ? `Connecting Auto-CCTV Feed for Room ${examHall}...` : `Initializing AI Models for Room ${examHall}...`}
                            </h3>
                            <p style={{ maxWidth: '520px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem', color: '#94a3b8' }}>
                                Surveillance starts automatically when a room is selected. Live feed will display momentarily.
                            </p>
                            <button 
                                className="btn-secondary" 
                                onClick={() => startCamera(selectedCameraId, examHall)}
                                style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}
                            >
                                <RefreshCw size={14} /> Reconnect Feed
                            </button>
                        </div>
                    )}
                </div>

                {/* Bottom Status Bar */}
                <div style={{
                    padding: '8px 20px',
                    background: '#05080e',
                    borderTop: '1px solid #1e293b',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.8rem',
                    color: '#94a3b8',
                    fontFamily: 'monospace'
                }}>
                    <span>AI Engine: Direct Attendance Face Matcher ({attendanceRegisteredStudents.length} Active Profiles Loaded)</span>
                    <span>Exam Cohort: {rangeStudents.length} Candidates Monitored</span>
                </div>
            </div>

            {/* Roster & Incident Navigation Tabs */}
            <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(48, 57, 76, 0.8)', paddingBottom: '1rem' }}>
                    
                    {/* Sub-tabs */}
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {[
                            { id: 'absent',    icon: UserX,        label: `Absent (${absentStudentsList.length})`,   color: '#F85149', bg: 'rgba(248,81,73,0.12)' },
                            { id: 'present',   icon: UserCheck,    label: `Present (${presentStudentsList.length})`, color: '#3FB950', bg: 'rgba(63,185,80,0.12)' },
                            { id: 'incidents', icon: AlertTriangle, label: `Breaches (${incidents.length})`,          color: '#D29922', bg: 'rgba(210,153,34,0.12)' },
                            { id: 'all',       icon: Users,        label: `Full Roster (${rangeStudents.length})`,   color: '#4F8EF7', bg: 'rgba(79,142,247,0.12)' },
                        ].map(({ id, icon: Icon, label, color, bg }) => (
                            <button
                                key={id}
                                onClick={() => setActiveRosterTab(id)}
                                style={{
                                    padding: '7px 13px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600',
                                    background: activeRosterTab === id ? bg : 'transparent',
                                    color: activeRosterTab === id ? color : '#8B949E',
                                    border: activeRosterTab === id ? `1px solid ${color}33` : '1px solid transparent',
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    fontSize: '0.82rem', fontFamily: 'inherit', transition: 'all 0.15s',
                                }}
                            >
                                <Icon size={15} />{label}
                            </button>
                        ))}
                    </div>

                    {/* Search & Export */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={14} color="#8B949E" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                            <input 
                                type="text"
                                className="input-field"
                                placeholder="Search roll / name…"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{ padding: '7px 10px 7px 32px', fontSize: '0.82rem', width: '200px' }}
                            />
                        </div>

                        {activeRosterTab === 'absent' && (
                            <button 
                                className="btn-secondary" 
                                onClick={exportAbsenteesCSV}
                                disabled={absentStudentsList.length === 0}
                                style={{ fontSize: '0.82rem' }}
                            >
                                <Download size={14} /> Absentees CSV
                            </button>
                        )}

                        <button 
                            className="btn-secondary" 
                            onClick={exportFullReportCSV}
                            style={{ fontSize: '0.82rem' }}
                        >
                            <Download size={14} /> Full Report
                        </button>
                    </div>
                </div>

                {/* 1. ABSENTEES / MISSING STUDENTS TAB */}
                {activeRosterTab === 'absent' && (
                    <div>
                        {absentStudentsList.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                <CheckCircle size={40} color="var(--success)" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                                <h3 style={{ color: 'var(--success)', margin: '0 0 6px 0' }}>All Range Students Present</h3>
                                <p style={{ margin: 0, fontSize: '0.9rem' }}>Every candidate assigned between {fromRoll || 'cohort start'} and {toRoll || 'cohort end'} has been identified and verified.</p>
                            </div>
                        ) : (
                            <div className="table-scroll">
                                <table style={{ textAlign: 'left', borderCollapse: 'collapse', width: '100%', whiteSpace: 'nowrap' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            <th style={{ padding: '0.8rem' }}>Roll Number</th>
                                            <th style={{ padding: '0.8rem' }}>Candidate Name</th>
                                            <th style={{ padding: '0.8rem' }}>Attendance Face Status</th>
                                            <th style={{ padding: '0.8rem' }}>Exam Status</th>
                                            <th style={{ padding: '0.8rem', textAlign: 'right' }}>Invigilator Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {absentStudentsList
                                            .filter(s => s.name?.toLowerCase().includes(searchQuery.toLowerCase()) || s.rollNumber?.includes(searchQuery))
                                            .map((s) => (
                                                <tr key={s._id} style={{ borderBottom: '1px solid var(--glass-border)', fontSize: '0.9rem' }}>
                                                    <td style={{ padding: '0.8rem', fontFamily: 'monospace', fontWeight: 'bold' }}>{s.rollNumber}</td>
                                                    <td style={{ padding: '0.8rem', fontWeight: '600' }}>{s.name}</td>
                                                    <td style={{ padding: '0.8rem' }}>
                                                        <span style={{ 
                                                            padding: '3px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600',
                                                            background: s.registeredFace ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)',
                                                            color: s.registeredFace ? 'var(--success)' : 'var(--danger)'
                                                        }}>
                                                            {s.registeredFace ? '✓ Attendance Face Linked' : '⚠️ No Attendance Face'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '0.8rem' }}>
                                                        <span style={{ 
                                                            background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', 
                                                            padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem' 
                                                        }}>
                                                            MISSING / ABSENT
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '0.8rem', textAlign: 'right' }}>
                                                        <button 
                                                            className="btn-secondary"
                                                            onClick={() => handleManualMark(s)}
                                                            style={{ padding: '4px 10px', fontSize: '0.8rem', borderColor: 'var(--success)', color: 'var(--success)' }}
                                                            title="Manually mark present upon physical ID verification"
                                                        >
                                                            Manual Mark Present
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* 2. VERIFIED PRESENT STUDENTS TAB */}
                {activeRosterTab === 'present' && (
                    <div>
                        {presentStudentsList.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                <Camera size={40} style={{ margin: '0 auto 10px auto', display: 'block', opacity: 0.5 }} />
                                <p style={{ margin: 0, fontWeight: '600' }}>No candidates verified yet</p>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>Start the CCTV camera stream to begin automated candidate recognition using attendance faces.</p>
                            </div>
                        ) : (
                            <div className="table-scroll">
                                <table style={{ textAlign: 'left', borderCollapse: 'collapse', width: '100%', whiteSpace: 'nowrap' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            <th style={{ padding: '0.8rem' }}>Roll Number</th>
                                            <th style={{ padding: '0.8rem' }}>Candidate Name</th>
                                            <th style={{ padding: '0.8rem' }}>Detected Timestamp</th>
                                            <th style={{ padding: '0.8rem' }}>Attendance Face Match</th>
                                            <th style={{ padding: '0.8rem' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {presentStudentsList
                                            .filter(p => p.student.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.student.rollNumber?.includes(searchQuery))
                                            .map((p) => (
                                                <tr key={p.student._id} style={{ borderBottom: '1px solid var(--glass-border)', fontSize: '0.9rem' }}>
                                                    <td style={{ padding: '0.8rem', fontFamily: 'monospace', fontWeight: 'bold' }}>{p.student.rollNumber}</td>
                                                    <td style={{ padding: '0.8rem', fontWeight: '600' }}>{p.student.name}</td>
                                                    <td style={{ padding: '0.8rem', color: 'var(--text-muted)' }}>{p.detectedAt}</td>
                                                    <td style={{ padding: '0.8rem' }}>
                                                        <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                                                            {p.confidence}%
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '0.8rem' }}>
                                                        <span style={{ 
                                                            background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', 
                                                            padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem' 
                                                        }}>
                                                            VERIFIED PRESENT
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* 3. SECURITY BREACHES & INCIDENT AUDIT TAB */}
                {activeRosterTab === 'incidents' && (
                    <div>
                        {incidents.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                <CheckCircle size={40} color="var(--success)" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                                <p style={{ fontWeight: '600', margin: 0 }}>Zero Security Breaches Detected</p>
                                <p style={{ fontSize: '0.85rem', margin: '4px 0 0 0' }}>No unauthorized out-of-cohort students or unregistered persons detected.</p>
                            </div>
                        ) : (
                            <div className="table-scroll">
                                <table style={{ textAlign: 'left', borderCollapse: 'collapse', width: '100%', whiteSpace: 'nowrap' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            <th style={{ padding: '0.8rem' }}>Incident ID</th>
                                            <th style={{ padding: '0.8rem' }}>Time</th>
                                            <th style={{ padding: '0.8rem' }}>Breach Type</th>
                                            <th style={{ padding: '0.8rem' }}>Detected Entity</th>
                                            <th style={{ padding: '0.8rem' }}>Assigned Cohort</th>
                                            <th style={{ padding: '0.8rem' }}>Snapshot Evidence</th>
                                            <th style={{ padding: '0.8rem' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {incidents.map((inc) => (
                                            <tr key={inc.id} style={{ borderBottom: '1px solid var(--glass-border)', fontSize: '0.9rem' }}>
                                                <td style={{ padding: '0.8rem', fontFamily: 'monospace', fontWeight: 'bold' }}>{inc.id}</td>
                                                <td style={{ padding: '0.8rem' }}>{inc.timestamp}</td>
                                                <td style={{ padding: '0.8rem' }}>
                                                    <span style={{ 
                                                        background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', 
                                                        padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem' 
                                                    }}>
                                                        {inc.type}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.8rem', color: 'var(--danger)', fontWeight: '700' }}>{inc.detectedName}</td>
                                                <td style={{ padding: '0.8rem', fontFamily: 'monospace' }}>{inc.assignedRange}</td>
                                                <td style={{ padding: '0.8rem' }}>
                                                    {inc.snapshot && (
                                                        <img 
                                                            src={inc.snapshot} 
                                                            alt="Evidence" 
                                                            onClick={() => setSelectedSnapshot(inc.snapshot)}
                                                            style={{ width: '60px', height: '36px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--danger)' }} 
                                                            title="Click to zoom evidence"
                                                        />
                                                    )}
                                                </td>
                                                <td style={{ padding: '0.8rem' }}>
                                                    <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                                        {inc.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* 4. FULL COHORT ROSTER TAB */}
                {activeRosterTab === 'all' && (
                    <div className="table-scroll">
                        <table style={{ textAlign: 'left', borderCollapse: 'collapse', width: '100%', whiteSpace: 'nowrap' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    <th style={{ padding: '0.8rem' }}>Roll Number</th>
                                    <th style={{ padding: '0.8rem' }}>Student Name</th>
                                    <th style={{ padding: '0.8rem' }}>Assigned Cohort</th>
                                    <th style={{ padding: '0.8rem' }}>Attendance Face Status</th>
                                    <th style={{ padding: '0.8rem' }}>Exam Attendance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rangeStudents
                                    .filter(s => s.name?.toLowerCase().includes(searchQuery.toLowerCase()) || s.rollNumber?.includes(searchQuery))
                                    .map((s) => {
                                        const isPresent = !!presentMap[s._id];
                                        return (
                                            <tr key={s._id} style={{ borderBottom: '1px solid var(--glass-border)', fontSize: '0.9rem' }}>
                                                <td style={{ padding: '0.8rem', fontFamily: 'monospace', fontWeight: 'bold' }}>{s.rollNumber}</td>
                                                <td style={{ padding: '0.8rem', fontWeight: '600' }}>{s.name}</td>
                                                <td style={{ padding: '0.8rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{fromRoll || 'Min'} - {toRoll || 'Max'}</td>
                                                <td style={{ padding: '0.8rem' }}>
                                                    <span style={{ 
                                                        padding: '3px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600',
                                                        background: s.registeredFace ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)',
                                                        color: s.registeredFace ? 'var(--success)' : 'var(--danger)'
                                                    }}>
                                                        {s.registeredFace ? '✓ Attendance Face Linked' : '⚠️ No Attendance Face'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.8rem' }}>
                                                    <span style={{ 
                                                        background: isPresent ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                        color: isPresent ? 'var(--success)' : 'var(--danger)', 
                                                        padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem' 
                                                    }}>
                                                        {isPresent ? `PRESENT (${presentMap[s._id].detectedAt})` : 'ABSENT'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Snapshot Zoom Modal */}
            {selectedSnapshot && (
                <div 
                    onClick={() => setSelectedSnapshot(null)}
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)',
                        zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'
                    }}
                >
                    <div style={{ maxWidth: '800px', width: '100%', background: '#0b0f19', padding: '1.5rem', borderRadius: '16px', border: '2px solid var(--danger)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, color: 'var(--danger)' }}>🚨 Exam Range Breach Evidence</h3>
                            <button className="btn-secondary" onClick={() => setSelectedSnapshot(null)}>Close</button>
                        </div>
                        <img src={selectedSnapshot} alt="Forensic Evidence" style={{ width: '100%', borderRadius: '8px', display: 'block' }} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExamProctoring;
