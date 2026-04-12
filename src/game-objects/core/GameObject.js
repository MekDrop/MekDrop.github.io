export class GameObject {
  constructor(props = {}) {
    Object.assign(this, props);
    this.active = props.active ?? true;
  }

  activate() {
    this.active = true;
  }

  deactivate() {
    this.active = false;
  }
}
