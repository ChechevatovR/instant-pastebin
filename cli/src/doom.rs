use std::{ffi::c_void, ops::DerefMut};

unsafe extern "C" {
    fn doom_entry(argc: i32, argv: *const *const u8);

    fn register_damage_callback(ctx: *mut c_void, cb: extern "C" fn(*mut c_void, i32));
}

struct CallbackCtx {
    damage_cb: Option<Box<dyn FnMut(i32)>>,
}

impl CallbackCtx {
    fn damage_callback(&mut self, damage: i32) {
        if let Some(damage_cb) = self.damage_cb.as_mut() {
            let f: &mut dyn FnMut(i32) = damage_cb.deref_mut();
            f(damage)
        }
    }
}

extern "C" fn damage_callback(ctx: *mut c_void, damage: i32) {
    unsafe {
        assert!(!ctx.is_null());
        let cb_ctx = &mut *(ctx as *mut CallbackCtx);
        cb_ctx.damage_callback(damage);
    }
}

pub struct Doom {
    damage_callback: Option<Box<dyn FnMut(i32)>>,
}

impl Doom {
    pub fn new() -> Self {
        Doom {
            damage_callback: None,
        }
    }

    pub fn set_damage_callback(&mut self, cb: Box<dyn FnMut(i32)>) {
        self.damage_callback = Some(cb);
    }

    pub fn run(self) {
        let mut doom_cb = CallbackCtx {
            damage_cb: self.damage_callback,
        };
        unsafe {
            let ctx: *mut CallbackCtx = &mut doom_cb;
            register_damage_callback(ctx as *mut std::ffi::c_void, damage_callback);
            let argv = ["".as_ptr(), "-episode".as_ptr(), "1".as_ptr()];
            doom_entry(argv.len() as i32, argv.as_ptr());
        }

        return;
    }
}

// Example usage
// let mut d = doom::Doom::new();
// d.set_damage_callback(Box::new(|damage: i32| {
//     println!("Dealt damage {damage}");
// }));
// d.run();

