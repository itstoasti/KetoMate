import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Food } from '@/types';
import { CircleCheck as CheckCircle2, Circle as XCircle, ChevronRight, Star } from 'lucide-react-native';

interface FoodCardProps {
  food: Food;
  onPress?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

// Helper function to get style based on rating
const getRatingStyle = (rating: Food['ketoRating']) => {
  switch (rating) {
    case 'Keto-Friendly':
      return styles.ketoFriendly; // Green
    case 'Limit':
      return styles.limit; // Yellow
    case 'Strictly Limit':
      return styles.strictlyLimit; // Red
    case 'Avoid':
      return styles.avoid; // Red
    default:
      return styles.unknownRating; // Default style
  }
};

const FoodCard: React.FC<FoodCardProps> = ({ food, onPress, isFavorite, onToggleFavorite }) => {
  const ratingStyle = getRatingStyle(food.ketoRating);

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {onToggleFavorite && (
        <TouchableOpacity 
          style={styles.favoriteButton}
          onPress={onToggleFavorite} 
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Star 
            size={24} 
            color={isFavorite ? "#FFC107" : "#ccc"} 
            fill={isFavorite ? "#FFC107" : "none"} 
          />
        </TouchableOpacity>
      )}
      
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={2}>{food.name}</Text>
        <Text style={[styles.ratingBase, ratingStyle]}>{food.ketoRating}</Text>
      </View>
      
      {food.brand && (
        <Text style={styles.brand}>{food.brand}</Text>
      )}
      
      <Text style={styles.serving}>Serving: {food.servingSize}</Text>
      
      <View style={styles.macros}>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{food.macros.carbs}g</Text>
          <Text style={styles.macroLabel}>Carbs</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{food.macros.protein}g</Text>
          <Text style={styles.macroLabel}>Protein</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{food.macros.fat}g</Text>
          <Text style={styles.macroLabel}>Fat</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{food.macros.calories}</Text>
          <Text style={styles.macroLabel}>Calories</Text>
        </View>
      </View>
      
      {onPress && (
        <View style={styles.chevron}>
          <ChevronRight size={20} color="#888" />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    position: 'relative',
  },
  favoriteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 6,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingRight: 30,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  ratingBase: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    marginLeft: 'auto',
  },
  ketoFriendly: {
    color: '#166534',
    backgroundColor: '#D1FAE5',
  },
  limit: {
    color: '#854d0e',
    backgroundColor: '#FEF9C3',
  },
  strictlyLimit: {
    color: '#991b1b',
    backgroundColor: '#FEE2E2',
  },
  avoid: {
    color: '#991b1b',
    backgroundColor: '#FEE2E2',
  },
  unknownRating: {
    color: '#555',
    backgroundColor: '#EAEAEA',
  },
  brand: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8
  },
  serving: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12
  },
  macros: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12
  },
  macroItem: {
    alignItems: 'center'
  },
  macroValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  macroLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 2
  },
  chevron: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -10 }]
  }
});

export default FoodCard;