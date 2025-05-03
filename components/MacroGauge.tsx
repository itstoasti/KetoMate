import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

interface MacroGaugeProps {
  label: string;
  current: number;
  max: number;
  unit: string;
  color: string;
  warning?: number; // Percentage at which to show warning color (e.g. 80 for 80%)
}

const MacroGauge: React.FC<MacroGaugeProps> = ({ 
  label, 
  current, 
  max, 
  unit, 
  color,
  warning = 80
}) => {
  const percentage = Math.min(100, (current / max) * 100);
  const progress = useSharedValue(0);
  
  // Animate progress on mount and when it changes
  React.useEffect(() => {
    progress.value = withTiming(percentage, { duration: 1000 });
  }, [percentage, progress]);
  
  const progressStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value}%`,
      backgroundColor: progress.value > warning ? '#FF5252' : color
    };
  });

  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {current.toFixed(1)} / {max} {unit}
        </Text>
      </View>
      <View style={styles.gaugeContainer}>
        <Animated.View style={[styles.gauge, progressStyle]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    width: '100%'
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333'
  },
  value: {
    fontSize: 14,
    color: '#666'
  },
  gaugeContainer: {
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    overflow: 'hidden'
  },
  gauge: {
    height: '100%',
    borderRadius: 6
  }
});

export default MacroGauge;