import { useEffect, useState, useRef } from 'react';
import '../pages/styles/Slider.scss';
import bgVideo from '../assades/Cover Video-compressed.mp4';

const Slider = () => {
  const [textIndex, setTextIndex] = useState(0);
  const { videoRef: sliderVideoRef, shouldLoad: shouldLoadSliderVideo } = useLazyVideo(bgVideo);

  // Custom hook for lazy video loading
  function useLazyVideo(src, options = {}) {
    const [isInView, setIsInView] = useState(false);
    const videoRef = useRef(null);

    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !isInView) {
            setIsInView(true);
          }
        },
        { threshold: 0.1, ...options }
      );

      if (videoRef.current) {
        observer.observe(videoRef.current);
      }

      return () => observer.disconnect();
    }, [isInView, options]);

    return { videoRef, shouldLoad: isInView };
  }

  const fashionTexts = [
    "Welcome to Yokebud Group Oy",
    "Discover Our New Collection",
    "Trendy Styles For Every Season",
    "Premium Quality Clothing",
    "Fashion That Fits Your Lifestyle"
  ];

  useEffect(() => {
    const textInterval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % fashionTexts.length);
    }, 4000);

    return () => {
      clearInterval(textInterval);
    };
  }, [fashionTexts.length]);

  const scrollToProducts = () => {
    const productsSection = document.getElementById('home_product');
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="slider">
      <div className="video-container">
        <video 
          ref={sliderVideoRef}
          autoPlay 
          muted 
          loop 
          playsInline
          preload="metadata"
          className="background-video"
          loading="lazy"
        >
          {shouldLoadSliderVideo && <source src={bgVideo} type="video/mp4" />}
          Your browser does not support the video tag.
        </video>
        <div className="video-overlay"></div>
      </div>

      <div className="mid_text">
        <span key={textIndex} className="fade-text">
          {fashionTexts[textIndex]}
        </span>
        <button className="shop-now-btn" onClick={scrollToProducts}>
          Shop Now
        </button>
      </div>
    </div>
  );
};

export default Slider;