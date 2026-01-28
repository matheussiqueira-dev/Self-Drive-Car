class Controls {
    constructor(type) {
        this.forward = false;
        this.left = false;
        this.right = false;
        this.reverse = false;

        switch (type) {
            case "KEYS":
                this.#addKeyboardListeners();
                break;
            case "DUMMY":
                this.forward = true;
                break;
        }
    }

    #addKeyboardListeners() {
        const updateKey = (event, isDown) => {
            switch (event.key) {
                case "ArrowLeft":
                    this.left = isDown;
                    break;
                case "ArrowRight":
                    this.right = isDown;
                    break;
                case "ArrowUp":
                    this.forward = isDown;
                    break;
                case "ArrowDown":
                    this.reverse = isDown;
                    break;
                default:
                    return;
            }
            event.preventDefault();
        };

        window.addEventListener("keydown", (event) => updateKey(event, true));
        window.addEventListener("keyup", (event) => updateKey(event, false));
    }
}
