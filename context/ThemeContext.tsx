import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStorageData, setStorageData, autoEndDay } from '../utils/storage';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  setTheme: () => {},
  isDark: false,
});

// New context for app-wide functionality
interface AppContextType {
  checkDayReset: () => Promise<void>;
}

const AppContext = createContext<AppContextType>({
  checkDayReset: async () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Schedule day reset check when app is in background/foreground
    checkDayReset();
    
    // Set up intervals to check at midnight and when app is active
    const midnightCheck = setupMidnightCheck();
    const activeCheck = setInterval(checkDayReset, 60 * 1000); // Check every minute when app is active
    
    return () => {
      clearInterval(activeCheck);
      if (midnightCheck) clearTimeout(midnightCheck);
    };
  }, []);
  
  // Calculate milliseconds until next midnight
  const getMillisToMidnight = (): number => {
    const now = new Date();
    const midnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0, 0, 0
    );
    return midnight.getTime() - now.getTime();
  };
  
  // Set up a timeout that will trigger at midnight
  const setupMidnightCheck = () => {
    const msToMidnight = getMillisToMidnight();
    
    return setTimeout(() => {
      checkDayReset();
      // Setup for next day after this runs
      setupMidnightCheck();
    }, msToMidnight);
  };
  
  // Logic to check and process day reset
  const checkDayReset = async (): Promise<void> => {
    try {
      const data = await getStorageData();
      const result = await autoEndDay(data);
      
      if (result) {
        await setStorageData(result);
        console.log('Day was automatically ended');
      }
    } catch (error) {
      console.error('Error in automatic day reset:', error);
    }
  };
  
  return (
    <AppContext.Provider value={{ checkDayReset }}>
      {children}
    </AppContext.Provider>
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<Theme>('system');

  useEffect(() => {
    // Load saved theme preference
    AsyncStorage.getItem('theme').then((savedTheme) => {
      if (savedTheme) {
        setThemeState(savedTheme as Theme);
      }
    });
  }, []);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    await AsyncStorage.setItem('theme', newTheme);
  };

  const isDark = theme === 'system' 
    ? systemColorScheme === 'dark'
    : theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
export const useApp = () => useContext(AppContext); 