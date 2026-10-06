import { PageHeading } from '../components/PageHeading';
import { Segmented } from '../components/Status';
import { useSettings, type TextSize, type Theme } from '../context/SettingsContext';

export default function Settings() {
  const { theme, setTheme, textSize, setTextSize } = useSettings();
  return (
    <>
      <PageHeading title="Settings">Settings</PageHeading>
      <p>These choices are saved on this device.</p>
      <Segmented<TextSize>
        legend="Text size"
        name="text-size"
        value={textSize}
        onChange={setTextSize}
        options={[
          { value: 0, label: 'Large' },
          { value: 1, label: 'Larger' },
          { value: 2, label: 'Largest' },
        ]}
      />
      <Segmented<Theme>
        legend="Colors"
        name="theme"
        value={theme}
        onChange={setTheme}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'cream', label: 'Cream' },
          { value: 'dark', label: 'Dark (gold)' },
          { value: 'navy', label: 'Navy' },
          { value: 'green', label: 'Dark green' },
          { value: 'contrast', label: 'High contrast' },
        ]}
      />
      <section className="section" aria-labelledby="sample-h">
        <h2 id="sample-h">Sample</h2>
        <p>This is how text will look in the app.</p>
      </section>
    </>
  );
}
