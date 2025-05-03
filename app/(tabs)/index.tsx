import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContext } from '@/context/AppContext';
import MacroGauge from '@/components/MacroGauge';
import MealCard from '@/components/MealCard';
import { Meal } from '@/types';
import { format } from 'date-fns';
import { Info, Plus, ArrowRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export default function Dashboard() {
  const router = useRouter();
  const { todayMacros, isLoading } = useAppContext();

  // Log the value received from context during render
  console.log("[Dashboard Render] todayMacros:", JSON.stringify(todayMacros, null, 2));

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  const groupedMeals = todayMacros.meals.reduce((acc, meal) => {
    const type = meal.type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(meal);
    return acc;
  }, {} as Record<MealType, Meal[]>);

  const mealOrder: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

  const renderMealGroup = (type: MealType) => {
    const mealsOfType = groupedMeals[type];
    if (!mealsOfType || mealsOfType.length === 0) {
      return null;
    }

    return (
      <View key={type} style={styles.mealGroupContainer}>
        <Text style={styles.mealGroupTitle}>
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </Text>
        {mealsOfType.map((meal) => (
          <MealCard key={meal.id} meal={meal} />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM d')}</Text>
          <Text style={styles.title}>Keto Dashboard</Text>
        </View>

        <View style={styles.macroCard}>
          <View style={styles.macroHeader}>
            <Text style={styles.macroTitle}>Today's Macros</Text>
            <TouchableOpacity style={styles.infoButton}>
              <Info size={18} color="#888" />
            </TouchableOpacity>
          </View>
          
          <MacroGauge 
            label="Carbs" 
            current={todayMacros.total.carbs} 
            max={todayMacros.limit.carbs} 
            unit="g" 
            color="#FF5252" 
            warning={90}
          />
          
          <MacroGauge 
            label="Protein" 
            current={todayMacros.total.protein} 
            max={todayMacros.limit.protein} 
            unit="g" 
            color="#FFC107" 
            warning={110}
          />
          
          <MacroGauge 
            label="Fat" 
            current={todayMacros.total.fat} 
            max={todayMacros.limit.fat} 
            unit="g" 
            color="#4CAF50" 
            warning={110}
          />
          
          <MacroGauge 
            label="Calories" 
            current={todayMacros.total.calories} 
            max={todayMacros.limit.calories} 
            unit="kcal" 
            color="#2196F3" 
            warning={100}
          />
          
          <View style={styles.ketoStatus}>
            <View style={[
              styles.ketoIndicator, 
              todayMacros.total.carbs <= todayMacros.limit.carbs 
                ? styles.ketoGoodIndicator 
                : styles.ketoBadIndicator
            ]} />
            <Text style={styles.ketoStatusText}>
              {todayMacros.total.carbs <= todayMacros.limit.carbs 
                ? 'You\'re in ketosis range!' 
                : 'Carbs too high for ketosis'}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Meals</Text>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push('/track')}
          >
            <Plus size={20} color="#4CAF50" />
            <Text style={styles.addButtonText}>Add Meal</Text>
          </TouchableOpacity>
        </View>

        {todayMacros.meals.length > 0 ? (
          mealOrder.map(type => renderMealGroup(type))
        ) : (
          <View style={styles.emptyMeals}>
            <Text style={styles.emptyMealsText}>No meals logged today</Text>
            <TouchableOpacity 
              style={styles.emptyMealsButton}
              onPress={() => router.push('/track')}
            >
              <Text style={styles.emptyMealsButtonText}>Track Your First Meal</Text>
              <ArrowRight size={16} color="#4CAF50" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  date: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: '#333',
  },
  macroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  macroTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#333',
  },
  infoButton: {
    padding: 4,
  },
  ketoStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  ketoIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  ketoGoodIndicator: {
    backgroundColor: '#4CAF50',
  },
  ketoBadIndicator: {
    backgroundColor: '#FF5252',
  },
  ketoStatusText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#555',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#333',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 4,
  },
  mealGroupContainer: {
    marginBottom: 16,
  },
  mealGroupTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#555',
    marginBottom: 8,
    marginLeft: 4,
  },
  emptyMeals: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  emptyMealsText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#888',
    marginBottom: 16,
  },
  emptyMealsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyMealsButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#4CAF50',
    marginRight: 6,
  },
});