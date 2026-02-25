import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface PreloaderProps {
  onComplete: () => void;
}

export const Preloader: React.FC<PreloaderProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Incremento mais lento: 1% a cada 50ms (total ~5 segundos)
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          // Pequeno atraso extra após chegar em 100% para suavidade
          setTimeout(onComplete, 800);
          return 100;
        }
        return prev + 1;
      });
    }, 50);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
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
        />
        
        <div className="w-64 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#ccff00]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: "linear" }}
          />
        </div>
      </motion.div>
    </div>
  );
};
