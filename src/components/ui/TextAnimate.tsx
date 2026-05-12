import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface TextAnimateProps {
  text: string;
  type?: 'popIn' | 'fadeIn' | 'slideUp';
  className?: string;
  delay?: number;
}

export const TextAnimate: React.FC<TextAnimateProps> = ({ 
  text, 
  type = 'fadeIn', 
  className,
  delay = 0 
}) => {
  const words = text.split(' ');

  const container = {
    hidden: { opacity: 0 },
    visible: (i = 1) => ({
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.04 * i + delay },
    }),
  };

  const child = {
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        damping: 12,
        stiffness: 100,
      },
    },
    hidden: {
      opacity: 0,
      y: type === 'slideUp' ? 20 : 0,
      scale: type === 'popIn' ? 0.5 : 1,
    },
  };

  return (
    <motion.div
      className={cn("flex flex-wrap gap-x-[0.25em]", className)}
      variants={container}
      initial="hidden"
      animate="visible"
    >
      {words.map((word, index) => (
        <motion.span
          key={index}
          variants={child}
          className="inline-block"
        >
          {word === "" ? "\u00A0" : word}
        </motion.span>
      ))}
    </motion.div>
  );
};
