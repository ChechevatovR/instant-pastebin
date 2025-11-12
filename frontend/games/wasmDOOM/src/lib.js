addToLibrary({
    CB_EnemyDamage: (damage) => {
        const event = new CustomEvent('doomEnemyDamage', {
            detail: { damage: damage },
            bubbles: true,
            cancelable: true
        })
        document.dispatchEvent(event)
    },
})
