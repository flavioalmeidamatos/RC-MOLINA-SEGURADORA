import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import preloaderImage from './prereloader.png';

interface PreloaderProps {
  onComplete: () => void;
}

export const Preloader: React.FC<PreloaderProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let completed = false;

    const finish = () => {
      if (completed) return;
      completed = true;
      setProgress(100);
      window.setTimeout(onComplete, 350);
    };

    const timer = window.setInterval(() => {
      setProgress((prev) => {
        const nextProgress = Math.min(prev + 5, 100);

        if (nextProgress >= 100) {
          window.clearInterval(timer);
          window.setTimeout(finish, 120);
        }

        return nextProgress;
      });
    }, 70);

    const maxWait = window.setTimeout(finish, 2500);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(maxWait);
    };
  }, [onComplete]);

  return (
    <div id="SCR-001" data-name="preloader" className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="flex flex-col items-center"
      >
        <img
          src={preloaderImage}
          alt="Logo"
          className="w-64 mb-8"
        />

        <div className="w-64 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#FFD700]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: 'linear' }}
          />
        </div>
      </motion.div>
    </div>
  );
};
