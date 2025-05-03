import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Meal } from '@/types';
import { useAppContext } from '@/context/AppContext';
import { format, parseISO, parse } from 'date-fns';
import { Clock, Utensils, Trash2 } from 'lucide-react-native';

interface MealCardProps {
  meal: Meal;
  onPress?: () => void;
}

const MealCard: React.FC<MealCardProps> = ({ meal, onPress }) => {
  const { removeMeal } = useAppContext();

  const mealTypeIcons = {
    breakfast: <Utensils size={16} color="#FFC107" />,
    lunch: <Utensils size={16} color="#4CAF50" />,
    dinner: <Utensils size={16} color="#FF5252" />,
    snack: <Utensils size={16} color="#9C27B0" />
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM d, yyyy');
    } catch (e) {
      return dateString;
    }
  };

  // Helper function to format time string
  const formatTime = (timeString: string): string => {
    if (!timeString || !timeString.includes(':')) {
        return timeString; // Return original if invalid
    }
    try {
        // Parse the HH:mm string relative to an arbitrary date (like today)
        // This allows date-fns to understand it's a time
        const time = parse(timeString, 'HH:mm', new Date()); 
        // Format it to h:mm a (e.g., 2:30 PM)
        return format(time, 'h:mm a'); 
    } catch (e) {
        console.warn(`[MealCard] Error formatting time: ${timeString}`, e);
        return timeString; // Fallback to original time string on error
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Confirm Deletion",
      `Are you sure you want to remove the meal "${meal.name}"? This cannot be undone.`, 
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Remove",
          onPress: () => {
            console.log(`[MealCard] Removing meal ${meal.id}`);
            removeMeal(meal.id);
          },
          style: "destructive"
        }
      ]
    );
  };

  // Function to clean the meal name for display
  const getDisplayName = (name: string): string => {
    // Regex to match "Breakfast - ", "Lunch - ", "Dinner - ", or "Snack - " at the start
    const prefixRegex = /^(Breakfast|Lunch|Dinner|Snack)\s*-\s*/i;
    return name.replace(prefixRegex, '');
  };

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
        <Trash2 size={18} color="#FF5252" />
      </TouchableOpacity>
      
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>{getDisplayName(meal.name)}</Text>
        <View style={styles.typeContainer}>
          {mealTypeIcons[meal.type]}
          <Text style={styles.type}>{meal.type.charAt(0).toUpperCase() + meal.type.slice(1)}</Text>
        </View>
      </View>
      
      <View style={styles.timeContainer}>
        <Clock size={14} color="#888" />
        <Text style={styles.time}>{formatTime(meal.time)} - {formatDate(meal.date)}</Text>
      </View>
      
      <View style={styles.foodsContainer}>
        <Text style={styles.foodsTitle}>Foods:</Text>
        {meal.foods.slice(0, 2).map((food, index) => (
          <Text key={index} style={styles.foodItem} numberOfLines={1}>
            • {food.name} {food.brand ? `(${food.brand})` : ''}
          </Text>
        ))}
        {meal.foods.length > 2 && (
          <Text style={styles.moreItems}>+{meal.foods.length - 2} more items</Text>
        )}
      </View>
      
      <View style={styles.macros}>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{meal.macros.carbs}g</Text>
          <Text style={styles.macroLabel}>Carbs</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{meal.macros.protein}g</Text>
          <Text style={styles.macroLabel}>Protein</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{meal.macros.fat}g</Text>
          <Text style={styles.macroLabel}>Fat</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{meal.macros.calories}</Text>
          <Text style={styles.macroLabel}>Calories</Text>
        </View>
      </View>
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
  deleteButton: {
    position: 'absolute',
    top: 14,
    right: 12,
    padding: 6,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingRight: 35,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    flexShrink: 0,
  },
  type: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
    marginLeft: 4
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  time: {
    fontSize: 14,
    color: '#888',
    marginLeft: 6
  },
  foodsContainer: {
    marginBottom: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  foodsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4
  },
  foodItem: {
    fontSize: 14,
    color: '#666',
    marginVertical: 2
  },
  moreItems: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 2
  },
  macros: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8
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
  }
});

export default MealCard;