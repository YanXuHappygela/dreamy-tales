import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

const LOADING_MESSAGES = [
  "Weaving your story…",
  "Sprinkling stardust…",
  "Gathering moonbeams…",
  "Waking the fireflies…",
  "Painting the night sky…",
];

export function LoadingStory() {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const [messageIndex, setMessageIndex] = React.useState(0);

  useEffect(() => {
    // Pulsing moon animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.15,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    // Cycle loading messages
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2200);

    return () => {
      pulse.stop();
      clearInterval(interval);
    };
  }, [scaleAnim]);

  return (
    <View style={styles.container}>
      {/* Stars */}
      {MINI_STARS.map((star, i) => (
        <View
          key={i}
          style={[
            styles.miniStar,
            {
              top: `${star.y}%` as any,
              left: `${star.x}%` as any,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
            },
          ]}
        />
      ))}

      <Animated.Text
        style={[styles.moonEmoji, { transform: [{ scale: scaleAnim }] }]}
      >
        🌙
      </Animated.Text>
      <Text style={styles.title}>Creating your story</Text>
      <Text style={styles.message}>{LOADING_MESSAGES[messageIndex]}</Text>

      {/* Dots */}
      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <DotBounce key={i} delay={i * 200} />
        ))}
      </View>
    </View>
  );
}

function DotBounce({ delay }: { delay: number }) {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(translateY, {
          toValue: -8,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.delay(600 - delay),
      ])
    );
    bounce.start();
    return () => bounce.stop();
  }, [delay, translateY]);

  return (
    <Animated.View
      style={[styles.dot, { transform: [{ translateY }] }]}
    />
  );
}

const MINI_STARS = Array.from({ length: 20 }, (_, i) => ({
  x: (i * 17 + 5) % 100,
  y: (i * 11 + 8) % 100,
  size: i % 3 === 0 ? 3 : 2,
  opacity: 0.15 + (i % 4) * 0.08,
}));

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0D0B2B",
    paddingHorizontal: 40,
  },
  miniStar: {
    position: "absolute",
    borderRadius: 99,
    backgroundColor: "#FFFFFF",
  },
  moonEmoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#F0EAF8",
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: "#9B8BB4",
    textAlign: "center",
    marginBottom: 32,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#C8A2E8",
  },
});
