import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface PreloaderProps {
  onComplete: () => void;
}

export const Preloader: React.FC<PreloaderProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    // Incremento mais lento: 1% a cada 50ms
    const timer = setInterval(() => {
      setProgress((prev) => {
        // Se já bateu 100, para
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }

        // Se a imagem ainda NÃO carregou, a barra trava nos 90%
        if (!imageLoaded && prev >= 90) {
          return 90;
        }

        return prev + 1;
      });
    }, 50);

    return () => clearInterval(timer);
  }, [imageLoaded]);

  // Efeito isolado para disparar o onComplete quando tudo estiver pronto
  useEffect(() => {
    if (progress === 100 && imageLoaded) {
      setTimeout(onComplete, 800);
    }
  }, [progress, imageLoaded, onComplete]);

  return (
    <div id="SCR-001" data-name="preloader" className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="flex flex-col items-center"
      >
        <img
          src="https://www.dropbox.com/scl/fi/1kots6b9qvk66ap2gqr2f/PRELOADER_RC.png?rlkey=xnnu1tr1dqcpzc7arksuv2gx6&raw=1"
          alt="Logo"
          className="w-64 mb-8"
          referrerPolicy="no-referrer"
          onLoad={() => setImageLoaded(true)}
        />

        <div className="w-64 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#FFD700]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: "linear" }}
          />
        </div>
      </motion.div>
    </div>
  );
};
