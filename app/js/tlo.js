// Rozmyte tło za ekranami: dwie warstwy, które płynnie przechodzą jedna w drugą.

export class Backdrop {
  constructor(root) {
    this.layers = [...root.querySelectorAll(".backdrop__layer")];
    this.current = 0;
    this.url = null;
  }

  set(url) {
    if (url === this.url) return;
    this.url = url;
    const image = new Image();
    image.src = url;
    image
      .decode()
      .catch(() => {})
      .then(() => {
        if (this.url !== url) return; // w międzyczasie wybrano inne tło
        const next = this.layers[1 - this.current];
        next.style.backgroundImage = `url("${url}")`;
        next.classList.add("is-on");
        this.layers[this.current].classList.remove("is-on");
        this.current = 1 - this.current;
      });
  }
}
