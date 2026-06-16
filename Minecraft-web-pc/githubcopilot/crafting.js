class CraftingRecipe {
    constructor(name, inputs, output, outputCount = 1) {
        this.name = name;
        this.inputs = inputs; // { blockType: count, ... }
        this.output = output;
        this.outputCount = outputCount;
    }
    
    canCraft(inventory) {
        for (const [blockType, needed] of Object.entries(this.inputs)) {
            const blockTypeNum = parseInt(blockType);
            let have = 0;
            for (const slot of inventory.slots) {
                if (slot && slot.type === blockTypeNum) {
                    have += slot.count;
                }
            }
            if (have < needed) return false;
        }
        return true;
    }
    
    craft(inventory) {
        // Remove inputs
        for (const [blockType, needed] of Object.entries(this.inputs)) {
            const blockTypeNum = parseInt(blockType);
            let remaining = needed;
            for (let i = 0; i < inventory.slots.length && remaining > 0; i++) {
                if (inventory.slots[i] && inventory.slots[i].type === blockTypeNum) {
                    const take = Math.min(inventory.slots[i].count, remaining);
                    inventory.slots[i].count -= take;
                    remaining -= take;
                    if (inventory.slots[i].count === 0) {
                        inventory.slots[i] = null;
                    }
                }
            }
        }
        
        // Add output
        let added = 0;
        for (let i = 0; i < inventory.slots.length && added < this.outputCount; i++) {
            if (!inventory.slots[i]) {
                inventory.slots[i] = {
                    type: this.output,
                    name: BLOCK_DATA[this.output].name,
                    count: Math.min(64, this.outputCount - added)
                };
                added = this.outputCount;
            } else if (inventory.slots[i].type === this.output && inventory.slots[i].count < 64) {
                const space = 64 - inventory.slots[i].count;
                const canAdd = Math.min(space, this.outputCount - added);
                inventory.slots[i].count += canAdd;
                added += canAdd;
            }
        }
    }
}

class CraftingMenu {
    constructor(game) {
        this.game = game;
        this.isOpen = false;
        this.recipes = [
            new CraftingRecipe('Planks', { [BLOCK_TYPES.LOG]: 1 }, BLOCK_TYPES.DIRT, 4),
            new CraftingRecipe('Sticks', { [BLOCK_TYPES.DIRT]: 2 }, BLOCK_TYPES.GRAVEL, 4),
        ];
    }
    
    toggle() {
        this.isOpen = !this.isOpen;
        this.render();
    }
    
    render() {
        let menu = document.getElementById('crafting-menu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'crafting-menu';
            document.body.appendChild(menu);
        }
        
        if (!this.isOpen) {
            menu.style.display = 'none';
            return;
        }
        
        menu.style.display = 'block';
        menu.innerHTML = '<h3>Crafting Menu (Press C to close)</h3>';
        
        for (let i = 0; i < this.recipes.length; i++) {
            const recipe = this.recipes[i];
            const canCraft = recipe.canCraft(this.game.inventory);
            const button = document.createElement('button');
            button.textContent = `${recipe.name} ${canCraft ? '✓' : '✗'}`;
            button.disabled = !canCraft;
            button.onclick = () => {
                if (canCraft) {
                    recipe.craft(this.game.inventory);
                    this.game.updateInventoryDisplay();
                }
            };
            menu.appendChild(button);
        }
    }
}
