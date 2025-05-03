import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Food } from '@/types';
import { CircleCheck as CheckCircle2, Circle as XCircle, ChevronRight } from 'lucide-react-native';

interface FoodCardProps {
  food: Food;
  onPress?: () => void;
}

const FoodCard: React.FC<FoodCardProps> = ({ food, onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.name}>{food.name}</Text>
        {food.isKetoFriendly ? (
          <View style={styles.ketoTag}>
            <CheckCircle2 size={16} color="#4CAF50" />
            <Text style={styles.ketoText}>Keto</Text>
          </View>
        ) : (
          <View style={styles.nonKetoTag}>
            <XCircle size={16} color="#FF5252" />
            <Text style={styles.nonKetoText}>Non-Keto</Text>
          </View>
        )}
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
    elevation: 2
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1
  },
  ketoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  ketoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 4
  },
  nonKetoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  nonKetoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF5252',
    marginLeft: 4
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