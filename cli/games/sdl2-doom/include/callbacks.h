#ifndef __CALLBACKS_H__
#define __CALLBACKS_H__

void register_damage_callback(void* ctx, void* cb);

void call_damage_callback(int damage);

#endif
