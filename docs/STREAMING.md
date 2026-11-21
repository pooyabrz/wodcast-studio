# Streaming setup and acceptance

## Programs

- Supported Node.js LTS release, version 22 or later.
- OBS Studio.
- Zoom desktop application and an existing meeting account.
- A current browser for the control panel.

No Firebase account, cloud subscription or Zoom SDK is used by the core application.

## OBS picture

1. Start the studio and open the control panel.
2. Create an OBS scene with a 1920 x 1080 canvas, preferably 30 FPS.
3. Add your camera as a video capture source.
4. Add a Browser Source above the camera.
5. Set its URL to `http://127.0.0.1:8787/overlay.html`, width 1920 and height 1080.
6. Disable shutdown when hidden and refresh when the scene becomes active to avoid unnecessary reconnects.
7. Fit the Browser Source to the canvas. The overlay itself has a transparent background.
8. Try start, pause, resume and reset. Refresh the browser source and confirm the current session is retained.

The illustrated gym is a control-panel preview background, not part of the output. OBS combines your camera with the overlay before it sends a complete picture onward.

## Sound cues

Sound originates in the control browser after clicking **Enable sound cues**. Activate it on the streaming computer. A different panel can take over audio ownership, so coordinate one audio output.

For an OBS recording/stream, capture the control browser's application or system audio using the audio options appropriate to the operating system and OBS version. Make a short recording and listen to it.

Browser background throttling and audio policies can affect audible cues. Hearing and timing must be checked on the target system even though the timer itself is server-owned.

## Zoom picture and sound

1. Start OBS Virtual Camera.
2. Select **OBS Virtual Camera** as the camera in Zoom.
3. Use OBS Program output for the intended finished scene.
4. Disable Zoom virtual backgrounds for this composed video path.
5. Select the microphone in Zoom.
6. Share computer audio separately when participants should hear cues. Zoom also supports computer-audio sharing without screen sharing.
7. Join from a second device and check the received picture and sound.

A 1080p project does not guarantee a 1080p feed for every Zoom account. Zoom's account, settings, device and network requirements still apply.

If Virtual Camera is unavailable on a target computer, sharing an OBS projector window is an alternative to evaluate. A virtual audio device is another possible routing option, but no driver is bundled or required by the core. Any added program, license or cost must be specified before agreement.

## Streamlabs

Use the same Browser Source URL and dimensions where compatible. OBS Studio is the primary target. Streamlabs has not been practically tested in this delivery.

## Acceptance record

Date: __________ OS: __________ Browser: __________

OBS version: __________ Zoom version: __________ Receiving device: __________

| Check | Result / observation |
| --- | --- |
| Three zones over the camera, transparent source background | |
| Upload, replace and remove a logo | |
| Countdown start/pause/resume/reset | |
| Stopwatch after lead-in | |
| Work/rest transitions and round count | |
| Refresh the output without resetting the session | |
| Leave and return to the OBS scene | |
| Readable content and visibility changes at the receiver | |
| OBS picture received in Zoom | |
| Lead-in, transition and finish cues heard once | |
| Saved layout restored after server restart | |
| Exported layout and logo imported on another studio | |
| Physical phone/tablet pairs on the private network | |

Mark the streaming path accepted only after completing this receiving-device check.

## Official references

- https://obsproject.com/kb/browser-source
- https://obsproject.com/kb/virtual-camera-guide
- https://obsproject.com/kb/video-call-streaming-tutorial
- https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0063608
- https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0066166
