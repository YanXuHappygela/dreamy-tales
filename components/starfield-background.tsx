import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: Animated.Value;
  duration: number;
  delay: number;
}

const NUM_STARS = 50;

function createStars(): Star[] {
  return Array.from({ length: NUM_STARS }, (_, i) => ({
    x: (i * 19.3 + 7) % 100,
    y: (i * 13.7 + 11) % 100,
    size: i % 4 === 0 ? 3 : i % 4 === 1 ? 2 : i % 4 === 2 ? 1.5 : 1,
    opacity: new Animated.Value(0.1 + (i % 5) * 0.1),
    duration: 2000 + (i % 7) * 800,
    delay: (i % 13) * 300,
  }));
}

const STARS = createStars();

export function StarfieldBackground() {
  const animationsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    const animations = STARS.map((star) => {
      const twinkle = Animated.loop(
        Animated.sequence([
          Animated.timing(star.opacity, {
            toValue: 0.05,
            duration: star.duration,
            delay: star.delay,
            useNativeDriver: true,
          }),
          Animated.timing(star.opacity, {
            toValue: 0.7,
            duration: star.duration,
            useNativeDriver: true,
          }),
        ])
      );
      return twinkle;
    });

    animationsRef.current = animations;
    animations.forEach((anim) => anim.start());

    return () => {
      animations.forEach((anim) => anim.stop());
    };
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {STARS.map((star, i) => (
        <Animated.View
          key={i}
          style={[
            styles.star,
            {
              left: `${star.x}%` as any,
              top: `${star.y}%` as any,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  star: {
    position: "absolute",
    borderRadius: 99,
    backgroundColor: "#FFFFFF",
  },
});
