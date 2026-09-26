(() => {
  const canvas = document.querySelector("[data-scroll-background]");
  const track = document.querySelector("[data-animation-track]");
  if (!canvas) return;

  const context = canvas.getContext("2d", { alpha: false, willReadFrequently: false });
  const frameCount = 300;
  const frames = [];
  let loaded = 0;
  let ready = false;
  let currentFrame = 0;
  let targetFrame = 0;
  let animationId = null;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const frameUrl = (frame) => `work/frames/ezgif-frame-${String(frame + 1).padStart(3, "0")}.jpg`;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (ready) drawFrame(currentFrame);
  }

  function drawFrame(position) {
    const image = frames[Math.floor(position)];
    if (!image) return;

    const canvasRatio = canvas.width / canvas.height;
    const imageRatio = image.naturalWidth / image.naturalHeight;
    const scale = imageRatio > canvasRatio
      ? canvas.height / image.naturalHeight
      : canvas.width / image.naturalWidth;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  }

  function animate() {
    const difference = targetFrame - currentFrame;
    if (Math.abs(difference) < 0.01) {
      currentFrame = targetFrame;
      drawFrame(currentFrame);
      animationId = null;
      return;
    }
    currentFrame += difference * 0.15;
    drawFrame(currentFrame);
    animationId = requestAnimationFrame(animate);
  }

  function updateTarget() {
    if (!ready) return;
    const maximumScroll = (track?.offsetHeight || document.documentElement.scrollHeight) - window.innerHeight;
    const scrollPosition = window.scrollY - (track?.offsetTop || 0);
    const progress = maximumScroll > 0 ? Math.min(1, Math.max(0, scrollPosition / maximumScroll)) : 0;
    targetFrame = progress * (frameCount - 1);
    if (!animationId) animationId = requestAnimationFrame(animate);
  }

  function loadFrames() {
    for (let frame = 0; frame < frameCount; frame += 1) {
      const image = new Image();
      image.onload = () => {
        frames[frame] = image;
        loaded += 1;
        if (loaded === frameCount) {
          ready = true;
          drawFrame(0);
          updateTarget();
        }
      };
      image.src = frameUrl(frame);
    }
  }

  window.addEventListener("resize", resizeCanvas, { passive: true });
  window.addEventListener("scroll", updateTarget, { passive: true });
  resizeCanvas();
  loadFrames();
})();
