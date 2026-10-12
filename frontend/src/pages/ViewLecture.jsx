import React, { useCallback, useEffect, useRef, useState } from 'react';
import webgazerEngine from '@webgazer-ts/core';
import '@mediapipe/face_mesh';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { FaPlayCircle } from 'react-icons/fa';
import { FaArrowLeftLong } from "react-icons/fa6";

function ViewLecture() {
  const { courseId } = useParams();
  const { courseData } = useSelector((state) => state.course);
  const {userData} = useSelector((state) => state.user)
  const selectedCourse = courseData?.find((course) => course._id === courseId);

  const [selectedLecture, setSelectedLecture] = useState(
    selectedCourse?.lectures?.[0] || null
  );
  const videoRef = useRef(null);
  const trackingStartedRef = useRef(false);
  const lastGazeInsideRef = useRef(Date.now());
  const trackingTimerRef = useRef(null);
  const [trackingStatus, setTrackingStatus] = useState("Eye tracking starts when you play a lecture");
  const [trackingError, setTrackingError] = useState("");

  const stopEyeTracking = useCallback(() => {
    if (trackingTimerRef.current) {
      clearInterval(trackingTimerRef.current);
      trackingTimerRef.current = null;
    }
    try {
      const webgazer = webgazerEngine
      if (webgazer && typeof webgazer.clearGazeListener === "function") webgazer.clearGazeListener();
      if (webgazer && typeof webgazer.end === "function") webgazer.end();
    } catch (error) {
      console.warn("Could not stop eye tracking cleanly:", error);
    }
    trackingStartedRef.current = false;
  }, []);

  const startEyeTracking = useCallback(async () => {
    if (trackingStartedRef.current || !videoRef.current) return;
    setTrackingError("");
    setTrackingStatus("Starting eye tracking…");

    try {
      const webgazer = webgazerEngine;
      if (!webgazer || typeof webgazer.begin !== "function" || typeof webgazer.setGazeListener !== "function") {
        throw new Error("The installed WebGazer package did not expose the expected API.");
      }
      // Use documented identifiers from the bundled package; avoid the broken remote script.
      webgazer.setTracker("TFFacemesh");
      webgazer.setRegression("ridge");
      await webgazer.begin();
      webgazer.setGazeListener((gaze) => {
        if (!gaze || gaze.x == null || gaze.y == null || !videoRef.current) return;
        const rect = videoRef.current.getBoundingClientRect();
        const inside = gaze.x >= rect.left && gaze.x <= rect.right &&
          gaze.y >= rect.top && gaze.y <= rect.bottom;
        if (inside) {
          lastGazeInsideRef.current = Date.now();
          setTrackingStatus("Focused — looking at the lecture");
        } else {
          setTrackingStatus("Look back at the lecture");
        }
      });
      trackingStartedRef.current = true;
      lastGazeInsideRef.current = Date.now();
      setTrackingStatus("Eye tracking active");

      trackingTimerRef.current = setInterval(() => {
        const video = videoRef.current;
        if (video && !video.paused && Date.now() - lastGazeInsideRef.current > 4000) {
          video.pause();
          setTrackingStatus("Lecture paused — look at the video to continue");
        }
      }, 500);
    } catch (error) {
      console.error("Lecture eye tracking failed:", error, error?.stack);
      setTrackingError(error?.message || "Eye tracking could not be started.");
      setTrackingStatus("Eye tracking unavailable");
      stopEyeTracking();
    }
  }, [stopEyeTracking]);

  useEffect(() => () => stopEyeTracking(), [stopEyeTracking]);
  const navigate = useNavigate()
  const courseCreator = userData?._id === selectedCourse?.creator ? userData : null;


  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col md:flex-row gap-6">
     
      {/* Left - Video & Course Info */}
      <div className="w-full md:w-2/3 bg-white rounded-2xl shadow-md p-6 border border-gray-200">
        {/* Course Details */}
        <div className="mb-6" >
           
          <h1 className="text-2xl font-bold flex items-center justify-start gap-[20px]  text-gray-800"><FaArrowLeftLong  className=' text-black w-[22px] h-[22px] cursor-pointer' onClick={()=>navigate("/")}/>{selectedCourse?.title}</h1>
          
          <div className="mt-2 flex gap-4 text-sm text-gray-500 font-medium">
            <span>Category: {selectedCourse?.category}</span>
            <span>Level: {selectedCourse?.level}</span>
          </div>
        </div>

        {/* Video Player */}
        <div className="aspect-video bg-black rounded-xl overflow-hidden mb-4 border border-gray-300">
          {selectedLecture?.videoUrl ? (
            <video
              ref={videoRef}
              src={selectedLecture.videoUrl}
              controls
              className="w-full h-full object-cover"
              crossOrigin="anonymous"
              onPlay={startEyeTracking}
              onPause={() => {
                if (trackingStartedRef.current) setTrackingStatus("Lecture paused");
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-white">
              Select a lecture to start watching
            </div>
          )}
        </div>

        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm font-semibold text-gray-800">{trackingStatus}</p>
          {trackingError && (
            <p className="mt-1 text-sm text-red-600">
              Eye tracking error: {trackingError}. The lecture video can still be watched; open the browser Console for the detailed error.
            </p>
          )}
          <p className="mt-1 text-xs text-gray-600">
            Eye tracking starts when you press Play. If your gaze stays outside the video for 4 seconds, playback pauses.
          </p>
        </div>

        {/* Selected Lecture Info */}
        <div className="mt-2">
          <h2 className="text-lg font-semibold text-gray-800">{selectedLecture?.lectureTitle}</h2>
          
        </div>
      </div>

      {/* Right - All Lectures + Creator Info */}
      <div className="w-full md:w-1/3 bg-white rounded-2xl shadow-md p-6 border border-gray-200 h-fit">
        <h2 className="text-xl font-bold mb-4 text-gray-800">All Lectures</h2>
        <div className="flex flex-col gap-3 mb-6">
          {selectedCourse?.lectures?.length > 0 ? (
            selectedCourse.lectures.map((lecture, index) => (
              <button
                key={index}
                onClick={() => {
                  const wasTracking = trackingStartedRef.current;
                  stopEyeTracking();
                  setSelectedLecture(lecture);
                  setTrackingError("");
                  setTrackingStatus("Eye tracking starts when you play a lecture");
                }}
                className={`flex items-center justify-between p-3 rounded-lg border transition text-left ${
                  selectedLecture?._id === lecture._id
                    ? 'bg-gray-200 border-gray-500'
                    : 'hover:bg-gray-50 border-gray-300'
                }`}
              >
                <div>
                  <h4 className="text-sm font-semibold text-gray-800">{lecture.lectureTitle}</h4>
                  
                </div>
                <FaPlayCircle className="text-black text-xl" />
              </button>
            ))
          ) : (
            <p className="text-gray-500">No lectures available.</p>
          )}
        </div>

        {/* Creator Info */}
        {courseCreator && (
  <div className="mt-4 border-t pt-4">
    <h3 className="text-md font-semibold text-gray-700 mb-3">Instructor</h3>
    <div className="flex items-center gap-4">
      <img
        src={courseCreator.photoUrl || '/default-avatar.png'}
        alt="Instructor"
        className="w-14 h-14 rounded-full object-cover border"
      />
      <div>
        <h4 className="text-base font-medium text-gray-800">{courseCreator.name}</h4>
        <p className="text-sm text-gray-600">
          {courseCreator.description || 'No bio available.'}
        </p>
      </div>
    </div>
  </div>
        )}
      </div>
    </div>
  );
}

export default ViewLecture;
