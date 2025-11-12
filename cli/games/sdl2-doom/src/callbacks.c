#include "callbacks.h"

typedef struct {
    void* damage_ctx;
    void(*damage_callback)(void*, int);
} s_rust_callbacks;

s_rust_callbacks rust_callbacks;

void register_damage_callback(void* ctx, void* cb) {
    rust_callbacks.damage_ctx = ctx;
    rust_callbacks.damage_callback = cb;
}

void call_damage_callback(int damage) {
    if (rust_callbacks.damage_callback) {
        rust_callbacks.damage_callback(rust_callbacks.damage_ctx, damage);
    }
}
