import { tauriService } from "../services/tauri";

type HooksTabProps = {
  preHook: string;
  postHook: string;
  hooksDir: string;
  onSave: (preHook: string, postHook: string) => void;
};

export function HooksTab({ preHook, postHook, hooksDir, onSave }: HooksTabProps): JSX.Element {
  return (
    <section className="panel split">
      <div>
        <label>Pre-run hook</label>
        <textarea
          rows={16}
          defaultValue={preHook}
          onBlur={(e) => onSave(e.target.value, postHook)}
        />
      </div>
      <div>
        <label>Post-run hook</label>
        <textarea
          rows={16}
          defaultValue={postHook}
          onBlur={(e) => onSave(preHook, e.target.value)}
        />
      </div>
      <div className="row">
        <button onClick={() => onSave(preHook, postHook)}>Save Hooks</button>
        <span className="muted">Stored in: {hooksDir}</span>
      </div>
    </section>
  );
}