import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import webgazerEngine from "@webgazer-ts/core";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const FocusTracker = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { courseId } = useParams();
  const courseVideoUrl = location.state?.videoUrl;
  const statusBoxRef = useRef(null);
  const contentBoxRef = useRef(null);
  const videoRef = useRef(null);
  const webgazerInitialized = useRef(false);
  const cleanupFunctions = useRef([]);

  const [status, setStatus] = useState("Initializing...");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
 const [isCalibrating, setIsCalibrating] = useState(false);
const [debugData, setDebugData] = useState({});


  const smoothedGaze = useRef({ x: 0, y: 0 });
  const focusConfidence = useRef(0);

  const gazeHistory = useRef([]);
  const focusStart = useRef(Date.now());
  const lastGazeTime = useRef(Date.now());
  const animationFrameId = useRef(null);
  const isCalibrated = useRef(false);
  const calibratedCenter = useRef({ x: 0, y: 0 });
  const calibrateSamples = useRef([]);

  const MAX_HISTORY = 25;
  const DISTRACT_TIME = 1000;
  const GAZE_TIMEOUT = 1000;
  const THROTTLE_DELAY = 50;
  const SMOOTHING_FACTOR = 0.3;

  const clamp = useCallback((val, min, max) => {
    return val < min ? min : val > max ? max : val;
  }, []);

  const getWeightedAverage = useCallback((values) => {
    if (!values.length) return null;
    let weightedSum = 0;
    let totalWeight = 0;
    values.forEach((val, index) => {
      const weight = Math.pow(1.2, index);
      weightedSum += val * weight;
      totalWeight += weight;
    });
    return weightedSum / totalWeight;
  }, []);

  const smoothGaze = useCallback((newX, newY) => {
    smoothedGaze.current.x = smoothedGaze.current.x * (1 - SMOOTHING_FACTOR) + newX * SMOOTHING_FACTOR;
    smoothedGaze.current.y = smoothedGaze.current.y * (1 - SMOOTHING_FACTOR) + newY * SMOOTHING_FACTOR;
    return smoothedGaze.current;
  }, []);

  const getContentBounds = useCallback(() => {
    if (!contentBoxRef.current) return null;
    try {
      const rect = contentBoxRef.current.getBoundingClientRect();
      const baseMarginX = rect.width * 0.08;
      // reduce vertical margin so small up/down eye movements are detected
      const baseMarginY = rect.height * 0.04;
      const confidenceMultiplier = isCalibrated.current ? 0.7 : 1.2;
      const marginX = baseMarginX * confidenceMultiplier;
      const marginY = baseMarginY * confidenceMultiplier;
      return {
        xMin: rect.left + marginX,
        xMax: rect.right - marginX,
        yMin: rect.top + marginY,
        yMax: rect.bottom - marginY,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height
      };
    } catch (err) {
      console.warn("Error getting content bounds:", err);
      return null;
    }
  }, []);

  const showAlert = useCallback(() => {
    const existingAlert = document.getElementById("alertBox");
    if (existingAlert) return;
    try {
      const alertDiv = document.createElement("div");
      alertDiv.id = "alertBox";
      Object.assign(alertDiv.style, {
        position: "fixed",
        top: "10px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#E74C3C",
        color: "white",
        padding: "10px 20px",
        borderRadius: "8px",
        fontWeight: "bold",
        zIndex: "10000",
        animation: "fadeIn 0.3s ease"
      });
      alertDiv.textContent = "👀 Look at the screen!";
      document.body.appendChild(alertDiv);
      setTimeout(() => {
        if (alertDiv && alertDiv.parentNode) {
          alertDiv.parentNode.removeChild(alertDiv);
        }
      }, 2000);
    } catch (err) {
      console.warn("Error showing alert:", err);
    }
  }, []);

  const lastProcessTime = useRef(0);
  const processGazeData = useCallback((data, elapsedTime) => {
    // Accept 0 values — treat only null/undefined/NaN as invalid
    if (!data || data.x === undefined || data.y === undefined || data.x === null || data.y === null || isNaN(data.x) || isNaN(data.y)) {
      // small debug: if data exists but invalid, log it (dev only)
      if (data && (data.x !== undefined || data.y !== undefined)) {
        // eslint-disable-next-line no-console
        console.debug('Invalid gaze frame:', data);
      }
      return;
    }
    const now = Date.now();
    if (now - lastProcessTime.current < THROTTLE_DELAY) return;
    lastProcessTime.current = now;

    lastGazeTime.current = now;
    const clampedX = clamp(data.x, 0, window.innerWidth);
    const clampedY = clamp(data.y, 0, window.innerHeight);
    const smoothed = smoothGaze(clampedX, clampedY);
    gazeHistory.current.push({ x: smoothed.x, y: smoothed.y, timestamp: now });
    if (gazeHistory.current.length > MAX_HISTORY) gazeHistory.current.shift();
    if (gazeHistory.current.length < 5) return;

    const recentGazes = gazeHistory.current.slice(-10);
    const avgX = getWeightedAverage(recentGazes.map(p => p.x));
    const avgY = getWeightedAverage(recentGazes.map(p => p.y));
    if (avgX === null || avgY === null) return;

    // If user calibrated, compute in-bounds relative to the calibrated center
    let isInBounds = false;
    const bounds = getContentBounds();
    if (!bounds) return;
    if (isCalibrated.current) {
      const dx = Math.abs(avgX - calibratedCenter.current.x);
      const dy = Math.abs(avgY - calibratedCenter.current.y);
      // allow a radius around the calibrated center (tweakable)
      const allowX = Math.max(120, bounds.width * 0.25);
      // reduce vertical allowance so looking up/down is detected more easily
      const allowY = Math.max(60, bounds.height * 0.15);
      isInBounds = dx <= allowX && dy <= allowY;
    } else {
      isInBounds = avgX >= bounds.xMin && avgX <= bounds.xMax && avgY >= bounds.yMin && avgY <= bounds.yMax;
    }

  if (isInBounds) focusConfidence.current = Math.min(1, focusConfidence.current + 0.12);
  else focusConfidence.current = Math.max(0, focusConfidence.current - 0.08);

    const isFocused = focusConfidence.current > 0.3;

    // expose debug data
    setDebugData({ rawX: data.x, rawY: data.y, avgX: Number(avgX.toFixed(1)), avgY: Number(avgY.toFixed(1)), focusConfidence: Number(focusConfidence.current.toFixed(2)), isInBounds, isFocused });
    // Debug data: { rawX: data.x, rawY: data.y, avgX: Number(avgX.toFixed(1)), avgY: Number(avgY.toFixed(1)), focusConfidence: Number(focusConfidence.current.toFixed(2)), isInBounds, isFocused }
    if (isFocused) {
      setStatus("Focused ✅");
      focusStart.current = now;
      if (videoRef.current?.paused) videoRef.current.play().catch(err => console.warn("Could not play video:", err));
    } else if (now - focusStart.current > DISTRACT_TIME) {
      setStatus("Distracted ❌");
      // attempt to pause
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        showAlert();
      }
    }
  }, [clamp, getWeightedAverage, smoothGaze, getContentBounds, showAlert, setDebugData]);

  // Calibration: sample gaze for 2s and set calibrated center
  const startCalibration = useCallback(() => {
    if (!webgazerInitialized.current) return;
    // setIsCalibrating(true);
    calibrateSamples.current = [];
    setStatus('Calibrating... please look at the video center');
    const collect = (data) => {
      if (!data || data.x == null || data.y == null) return;
      calibrateSamples.current.push({ x: data.x, y: data.y });
    };
    // temporary listener
    const listener = (d) => collect(d);
    if (webgazerEngine && typeof webgazerEngine.setGazeListener === 'function') {
      webgazerEngine.setGazeListener(listener);
    }
    setTimeout(() => {
      // stop collecting: restore original listener
      if (webgazerEngine && typeof webgazerEngine.setGazeListener === 'function') {
        webgazerEngine.setGazeListener(processGazeData);
      }
      const samples = calibrateSamples.current;
      if (samples.length === 0) {
        setStatus('Calibration failed — no samples');
        // setIsCalibrating(false);
        return;
      }
      const avgX = samples.reduce((s, p) => s + p.x, 0) / samples.length;
      const avgY = samples.reduce((s, p) => s + p.y, 0) / samples.length;
      calibratedCenter.current = { x: avgX, y: avgY };
      isCalibrated.current = true;
      setIsCalibrating(false);
      setStatus('Calibration complete — testing');
    }, 3000);
  }, [processGazeData, setIsCalibrating]);

  const checkGazeTimeout = useCallback(() => {
    const now = Date.now();
    if (now - lastGazeTime.current > GAZE_TIMEOUT) {
      setStatus("No Eye Tracking ⚠");
      if (videoRef.current && !videoRef.current.paused) videoRef.current.pause();
    }
    animationFrameId.current = requestAnimationFrame(checkGazeTimeout);
  }, []);

  const initializeWebGazer = useCallback(async () => {
    if (webgazerInitialized.current) return;

    try {
      const webgazer = webgazerEngine;
      if (!webgazer) throw new Error("WebGazer library did not load.");

      setError(null);
      setStatus("Initializing eye tracking...");

      // Configure the locally bundled WebGazer package.
      if (typeof webgazer.setTracker === "function") webgazer.setTracker("TFFacemesh");
      if (typeof webgazer.setRegression === "function") webgazer.setRegression("ridge");
      if (webgazer.params) {
        webgazer.params.showVideo = true;
        webgazer.params.showFaceOverlay = false;
        webgazer.params.showFaceFeedbackBox = false;
        webgazer.params.showGazeDot = false;
      }

      if (typeof webgazer.begin !== "function") {
        throw new Error("The loaded WebGazer version does not expose begin().");
      }
      await webgazer.begin();

      let ready = typeof webgazer.isReady !== "function";
      for (let attempts = 0; attempts < 15 && !ready; attempts++) {
        await new Promise(resolve => setTimeout(resolve, 300));
        ready = webgazer.isReady();
      }
      if (!ready) throw new Error("WebGazer initialization timed out. Check camera permission and reload.");

      if (typeof webgazer.setGazeListener !== "function") {
        throw new Error("The loaded WebGazer version does not expose setGazeListener().");
      }
      webgazer.setGazeListener(processGazeData);
      if (typeof webgazer.showVideoPreview === "function") webgazer.showVideoPreview(true);
      if (typeof webgazer.showPredictionPoints === "function") webgazer.showPredictionPoints(false);

      webgazerInitialized.current = true;
      setIsLoading(false);
      setStatus("Please look at different parts of the screen to calibrate");
      try { startCalibration(); } catch (e) { console.warn("Calibration could not start:", e); }
      checkGazeTimeout();
    } catch (err) {
      console.error("WebGazer initialization failed:", err, err?.stack);
      setError(`Failed to initialize eye tracking: ${err?.message || "Unknown error"}`);
      setIsLoading(false);
      webgazerInitialized.current = false;
      try {
        if (webgazerEngine && typeof webgazerEngine.end === "function") {
          webgazerEngine.end();
        }
      } catch (cleanupError) {
        console.warn("WebGazer cleanup after initialization failure:", cleanupError);
      }
    }
  }, [processGazeData, checkGazeTimeout, startCalibration]);
  const loadWebGazer = useCallback(() => {
    setError(null);
    setIsLoading(true);
    initializeWebGazer();
  }, [initializeWebGazer]);

  const cleanup = useCallback(() => {
    try {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (webgazerEngine && webgazerInitialized.current) {
        webgazerEngine.clearGazeListener(); webgazerEngine.end();
      }
      cleanupFunctions.current.forEach(fn => { try { fn(); } catch {} });
      const alertBox = document.getElementById("alertBox");
      if (alertBox && alertBox.parentNode) alertBox.parentNode.removeChild(alertBox);
      webgazerInitialized.current = false;
      gazeHistory.current = [];
    } catch {}
  }, []);

  useEffect(() => { loadWebGazer(); return () => cleanup(); }, [loadWebGazer, cleanup]);

  const handleVideoError = useCallback((e) => { console.warn("Video error:", e); setError("Video failed to load."); }, []);

  const statusStyle = useMemo(() => ({
    fontSize: "1.8em",
    fontWeight: "bold",
    padding: "15px",
    borderRadius: "10px",
    marginTop: "20px",
    display: "inline-block",
    color: "white",
    transition: "all 0.3s ease",
    background: status.includes("Focused") ? "#2ECC71" : status.includes("Distracted") ? "#E74C3C" : status.includes("No Eye") ? "#F39C12" : "#95A5A6"
  }), [status]);

  if (error) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px", color: "#E74C3C" }}>
        <h2>Error</h2>
        <p>{error}</p>
        <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
          <button type="button" onClick={loadWebGazer} style={{ padding: "10px 20px", background: "#3498DB", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}>Retry Eye Tracking</button>
          <button type="button" onClick={() => navigate(courseId ? `/viewcourse/${courseId}` : "/")} style={{ padding: "10px 20px", background: "#666", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}>Back to Course</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", marginTop: "30px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
        <button type="button" onClick={() => navigate(courseId ? `/viewcourse/${courseId}` : "/")} style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #bbb", cursor: "pointer" }}>← Back to course</button>
        <h1>Smart Attention Tracker</h1>
      </div>
      <p>{isLoading ? "Loading eye tracking..." : "Focus on the video below. Eye tracking will pause/play automatically."}</p>
      {!courseVideoUrl && <p style={{ color: "#B45309" }}>No course lecture was passed to the tracker, so the demo video is shown. Return to the course and select a preview lecture first.</p>}
      <div ref={contentBoxRef} style={{ width: "70%", maxWidth: "800px", height: "400px", margin: "20px auto", border: "3px solid #333", borderRadius: "10px", position: "relative", display: "flex", justifyContent: "center", alignItems: "center", background: "#000" }}>
        <video ref={videoRef} width="100%" height="100%" controls preload="metadata" onError={handleVideoError} style={{ borderRadius: "7px" }}>
          <source src={courseVideoUrl || "https://media.w3.org/2010/05/sintel/trailer_hd.mp4"} type="video/mp4" />
          Your browser does not support video playback.
        </video>
      </div>
      <div ref={statusBoxRef} style={statusStyle}>{status}</div>
      
    </div>
  );
};

export default FocusTracker;