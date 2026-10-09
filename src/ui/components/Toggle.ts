/**
 * Componente de toggle (switch) reutilizable para SCREENREC
 */

interface ToggleProps {
  id: string;
  label: string;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  className?: string;
  /** Si es true, la etiqueta se interpreta como HTML (para incluir iconos SVG). */
  labelAsHtml?: boolean;
}

export class Toggle {
  private container: HTMLDivElement;
  private input: HTMLInputElement;
  private slider: HTMLSpanElement;

  constructor(props: ToggleProps) {
    this.container = document.createElement("div");
    this.container.className = `audio-toggle ${props.disabled ? "disabled" : ""} ${props.className || ""}`;

    // Crear span para el label
    const labelSpan = document.createElement("span");
    labelSpan.id = `${props.id}-label`;
    if (props.labelAsHtml) {
      labelSpan.innerHTML = props.label;
    } else {
      labelSpan.textContent = props.label;
    }

    // Crear label para el switch
    const switchLabel = document.createElement("label");
    switchLabel.className = "switch";

    // Crear input checkbox
    this.input = document.createElement("input");
    this.input.type = "checkbox";
    this.input.id = props.id;
    this.input.setAttribute("aria-labelledby", labelSpan.id);
    this.input.checked = props.checked || false;
    this.input.disabled = props.disabled || false;

    // Crear slider
    this.slider = document.createElement("span");
    this.slider.className = "slider-toggle";

    // Ensamblar switch
    switchLabel.appendChild(this.input);
    switchLabel.appendChild(this.slider);

    // Añadir event listener
    if (props.onChange) {
      this.input.addEventListener("change", () => {
        props.onChange!(this.input.checked);
      });
    }

    // Ensamblar container
    this.container.appendChild(labelSpan);
    this.container.appendChild(switchLabel);
  }

  public getElement(): HTMLDivElement {
    return this.container;
  }

  public getChecked(): boolean {
    return this.input.checked;
  }

  public setChecked(checked: boolean): void {
    this.input.checked = checked;
  }

  public setDisabled(disabled: boolean): void {
    this.input.disabled = disabled;
    this.container.classList.toggle("disabled", disabled);
  }

  public destroy(): void {
    this.container.remove();
  }
}
