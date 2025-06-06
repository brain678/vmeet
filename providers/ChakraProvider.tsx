'use client';

import { ChakraProvider as BaseProvider, extendTheme } from "@chakra-ui/react";
import { ReactNode } from "react";

const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  styles: {
    global: {
      'html, body': {
        bg: 'transparent',
        color: 'white'
      }
    }
  },
  colors: {
    brand: {
      50: '#E3F2FD',
      100: '#BBDEFB',
      200: '#90CAF9',
      300: '#64B5F6',
      400: '#42A5F5',
      500: '#1E88E5',  // primary
      600: '#1976D2',  // secondary
      700: '#1565C0',
      800: '#0D47A1',
      900: '#0A2472'
    }
  },
  components: {
    Button: {
      baseStyle: {
        _hover: {
          transform: 'translateY(-1px)',
          boxShadow: 'lg'
        }
      },
      defaultProps: {
        colorScheme: 'brand',
        variant: 'solid'
      }
    },
    Box: {
      defaultProps: {
        color: 'white'
      }
    },
    Text: {
      defaultProps: {
        color: 'white'
      }
    },
    Modal: {
      baseStyle: {
        overlay: {
          bg: 'blackAlpha.800'
        },
        dialog: {
          bg: '#1C1F2E'
        }
      }
    }
  }
});

interface Props {
  children: ReactNode;
}

export function ChakraProvider({ children }: Props) {
  return (
    <BaseProvider theme={theme}>
      {children}
    </BaseProvider>
  );
}
