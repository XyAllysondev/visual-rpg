import useReducedMotion from "../lib/useReducedMotion";

/* Ambient fog backdrop (Higgsfield item 1+6). Static poster under reduced
   motion / slow connections; looping video otherwise. */
export default function AmbientBackdrop() {
  const reduced = useReducedMotion();
  return (
    <div className="nx-ambient" aria-hidden="true">
      {reduced ? (
        <img src="/assets/higgsfield/video/fog-poster.jpg" alt="" />
      ) : (
        <video
          autoPlay muted loop playsInline
          poster="/assets/higgsfield/video/fog-poster.jpg"
        >
          <source src="/assets/higgsfield/video/fog-loop.webm" type="video/webm" />
          <source src="/assets/higgsfield/video/fog-loop.mp4" type="video/mp4" />
        </video>
      )}
    </div>
  );
}
