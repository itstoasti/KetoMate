import { Tabs } from 'expo-router/tabs';
import { ThemeProvider, AppProvider, useTheme } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';

export default function Layout() {
  return (
    <AppProvider>
      <ThemeProvider>
        <RootTabs />
      </ThemeProvider>
    </AppProvider>
  );
}

function RootTabs() {
  const { isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            display: 'none',
          },
        }}
      >
        <Tabs.Screen
          name="(tabs)"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </>
  );
}
