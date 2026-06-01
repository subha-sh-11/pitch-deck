const PARTICLES = [
  { top: "12%", left: "8%", delay: "0s" },
  { top: "28%", left: "72%", delay: "1.2s" },
  { top: "55%", left: "18%", delay: "2.4s" },
  { top: "70%", left: "85%", delay: "0.8s" },
  { top: "40%", left: "45%", delay: "3s" },
  { top: "82%", left: "55%", delay: "1.8s" },
];

export function PreviewCinematicBackground() {
  return (
    <div className="preview-studio-bg" aria-hidden>
      <div className="preview-studio-bg__gradient" />
      <div className="preview-studio-bg__spotlight" />
      <div className="preview-studio-bg__grid" />
      <div className="preview-studio-bg__noise" />
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="preview-studio-bg__particle"
          style={{
            top: p.top,
            left: p.left,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}
