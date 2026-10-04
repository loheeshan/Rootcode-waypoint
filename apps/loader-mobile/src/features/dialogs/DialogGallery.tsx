import { ActionButton, Screen } from '../../components/ui/ScreenKit';
import { useDialog } from './DialogProvider';
import { dialogs, type DialogId } from './dialogs';

export default function DialogGallery() {
  const { openDialog } = useDialog();
  return (
    <Screen title="Dialog preview">
      {(Object.keys(dialogs) as DialogId[]).map((id) => (
        <ActionButton key={id} small variant="secondary" label={dialogs[id].title} onPress={() => openDialog(id)} />
      ))}
    </Screen>
  );
}