import { motion } from 'framer-motion';
import { ArrowRight, Gamepad2, Trophy, Users } from 'lucide-react';

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <img
          src="/lola.gif"
          alt="LOLA"
          className="w-full h-full object-cover opacity-60"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/70" />
      </div>

      {/* Floating Emojis */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute opacity-20"
          style={{ fontSize: `${2 + Math.random() * 3}rem`, left: `${10 + i * 12}%`, top: `${15 + (i % 4) * 20}%` }}
          animate={{
            y: [0, -40 - Math.random() * 20, 0],
            rotate: [0, 15, -15, 0],
            scale: [1, 1.1 + Math.random() * 0.2, 1],
          }}
          transition={{
            duration: 3 + i * 0.7,
            repeat: Infinity,
            delay: i * 0.4,
          }}
        >
          {['🍄', '✨', '🎮', '💎', '⭐', '🔥', '🏆', '🎯'][i]}
        </motion.div>
      ))}

      {/* Content */}
      <div className="relative z-10 text-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.p
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="text-6xl mb-4"
          >
            🍄
          </motion.p>

          <p className="text-3xl md:text-5xl font-bold text-white mb-4">
            Играй. Общайся. Побеждай.
          </p>

          <p className="text-lg md:text-xl text-gray-200 mb-8 max-w-2xl mx-auto">
            Among Us, Clash Royale, Minecraft, Шахматы, JackBox и многое другое! Более 15 игр, турниры и дружное комьюнити.
          </p>

          {/* Quick Stats */}
          <div className="flex gap-6 justify-center mb-8 text-sm text-gray-300">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-mushroom-neon" />
              <span>Дружное комьюнити</span>
            </div>
            <div className="flex items-center gap-2">
              <Gamepad2 size={16} className="text-mushroom-neon" />
              <span>15+ игр</span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-mushroom-neon" />
              <span>Турниры и ивенты</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="https://discord.gg/lolaamongus"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-discord text-lg flex items-center gap-2"
            >
              Присоединиться к серверу
              <ArrowRight size={20} />
            </a>

            <a
              href="/games"
              className="btn-primary text-lg"
            >
              Смотреть игры
            </a>
          </div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <div className="w-6 h-10 border-2 border-mushroom-neon rounded-full flex items-start justify-center p-2">
          <motion.div
            className="w-1 h-2 bg-mushroom-neon rounded-full"
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
