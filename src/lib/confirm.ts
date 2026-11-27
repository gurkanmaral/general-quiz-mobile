import { Alert } from 'react-native';

/** A native confirmation dialog; resolves true when the player confirms. */
export function confirm({ title, message, action, destructive = true, cancel = 'Cancel' }: { title: string; message?: string; action: string; destructive?: boolean; cancel?: string }): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancel, style: 'cancel', onPress: () => resolve(false) },
        { text: action, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
