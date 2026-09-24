// In-memory mock database, shaped like the NestJS backend's responses.
// Used only when the backend is unreachable (see withFallback).
import { packDescription } from '@/utils/format'

const img = (seed) => `https://picsum.photos/seed/${seed}/600/600`
const minutesAgo = (m) => new Date(Date.now() - m * 60_000).toISOString()
const nextAt = (h, m) => {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1)
  return d.toISOString()
}

const QR = '/mock/seller-qr.png'
export const ME = { userId: 'LDB0001', fullName: 'ພະນັກງານ ທົດສອບ', department: 'IT', phoneNumber: '020 5555 0001', qrPaymentUrl: QR }

const S = {
  somphone: { userId: 'LDB1023', fullName: 'ສົມພອນ', department: 'ບັນຊີ', phoneNumber: '020 5555 1023', qrPaymentUrl: QR },
  noy: { userId: 'LDB2045', fullName: 'ນ້ອຍ', department: 'HR', phoneNumber: '020 5555 2045', qrPaymentUrl: QR },
  keo: { userId: 'LDB3311', fullName: 'ແກ້ວ', department: 'IT', phoneNumber: '020 5555 3311', qrPaymentUrl: null },
  bounmy: { userId: 'LDB1208', fullName: 'ບຸນມີ', department: 'ການຕະຫຼາດ', phoneNumber: '020 5555 1208', qrPaymentUrl: QR },
  vanna: { userId: 'LDB4410', fullName: 'ວັນນາ', department: 'ສິນເຊື່ອ', phoneNumber: '020 5555 4410', qrPaymentUrl: QR },
}
export const USERS = [ME, ...Object.values(S)]

const item = (itemId, { seller, text = '', cutoff, condition, ...rest }) => ({
  itemId,
  sellerId: seller.userId,
  seller,
  status: 'AVAILABLE',
  images: [img(`icm-${itemId}-a`), img(`icm-${itemId}-b`), img(`icm-${itemId}-c`)],
  description: packDescription(text, { orderCutoffTime: cutoff, condition }),
  ...rest,
})

export const db = {
  items: [
    item(1, { title: 'ເຂົ້າມັນໄກ່ ສູດແມ່ (Pre-order ມື້ນີ້)', price: 35000, itemType: 'FOOD', pickupLocation: 'Pantry ຊັ້ນ 2',
      text: 'ເຂົ້າມັນໄກ່ ນ້ຳຈິ້ມສູດພິເສດ ແຖມນ້ຳແກງ. ສົ່ງຮອດ Pantry ເວລາ 11:45.', cutoff: nextAt(10, 30), seller: S.somphone, createdAt: minutesAgo(35) }),
    item(2, { title: 'ກາເຟລາວເຢັນ + ຂະໜົມປັງເນີຍ', price: 20000, itemType: 'FOOD', pickupLocation: 'Pantry ຊັ້ນ 3',
      text: 'ກາເຟປາກຊ່ອງແທ້ 100%. ສັ່ງກ່ອນ 14:00 ຮັບ 15:00.', cutoff: nextAt(14, 0), seller: S.noy, createdAt: minutesAgo(80) }),
    item(3, { title: 'iPhone 12 128GB ສີຂາວ ແບັດ 86%', price: 3500000, itemType: 'SECOND_HAND', condition: 'ດີຫຼາຍ (90%+)', pickupLocation: 'ຕຶກ IT',
      text: 'ໃຊ້ມາ 2 ປີ, ບໍ່ເຄີຍຕົກ, ມີກັບ + ສາຍສາກ. ລອງເຄື່ອງໄດ້ກ່ອນຈ່າຍ.', seller: S.keo, createdAt: minutesAgo(180) }),
    item(4, { title: 'ປຶ້ມ Clean Code + Refactoring (ແຈກຟຣີ)', price: 0, itemType: 'FREE', condition: 'ດີ (70-90%)', pickupLocation: 'ຕຶກໃຫຍ່',
      text: 'ອ່ານຈົບແລ້ວ ຢາກສົ່ງຕໍ່ໃຫ້ນ້ອງໆ Dev. ມາເອົາໄດ້ໂຕະ 4F-12.', seller: S.keo, createdAt: minutesAgo(240) }),
    item(5, { title: 'ຕຳໝາກຫຸ່ງ + ໄກ່ຍ່າງ ຊຸດທ່ຽງ', price: 30000, itemType: 'FOOD', pickupLocation: 'Pantry ຊັ້ນ 4',
      text: 'ເຜັດໜ້ອຍ/ກາງ/ຫຼາຍ ບອກໃນແຊັດ.', cutoff: nextAt(10, 0), seller: S.vanna, createdAt: minutesAgo(50) }),
    item(6, { title: 'Mechanical Keyboard Keychron K2 (Brown switch)', price: 450000, itemType: 'SECOND_HAND', status: 'RESERVED', condition: 'ດີ (70-90%)',
      pickupLocation: 'ຕຶກ IT', text: 'ໃຊ້ໄດ້ປົກກະຕິ, ມີ keycap ສຳຮອງ.', seller: S.bounmy, createdAt: minutesAgo(600) }),
    item(7, { title: 'ຕົ້ນໄມ້ປະດັບໂຕະ (Monstera ນ້ອຍ)', price: 0, itemType: 'FREE', pickupLocation: 'Pantry ຊັ້ນ 4',
      text: 'ແຍກໜໍ່ມາຫຼາຍ ແຈກຟຣີ 3 ກະຖາງ.', seller: S.noy, createdAt: minutesAgo(20) }),
    item(8, { title: 'ເຂົ້າໜຽວໝູປີ້ງ + ແຈ່ວ', price: 25000, itemType: 'FOOD', status: 'SOLD', pickupLocation: 'Pantry ຊັ້ນ 2',
      cutoff: nextAt(9, 0), seller: S.bounmy, createdAt: minutesAgo(300) }),
    item(9, { title: 'ຈໍ Monitor Dell 24" P2419H', price: 800000, itemType: 'SECOND_HAND', condition: 'ດີຫຼາຍ (90%+)', pickupLocation: 'ຕຶກໃຫຍ່',
      text: 'IPS Full HD, ມີສາຍ HDMI. ຍ້າຍໄປໃຊ້ Laptop ແລ້ວ.', seller: S.somphone, createdAt: minutesAgo(1440) }),
    item(10, { title: 'ເຄັກກ້ວຍຫອມ ບ້ານເຮັດ (ຊິ້ນ)', price: 15000, itemType: 'FOOD', pickupLocation: 'Pantry ຊັ້ນ 2',
      cutoff: nextAt(15, 30), seller: S.vanna, createdAt: minutesAgo(15) }),
    item(11, { title: 'ເມົ້າ Logitech MX Anywhere 3', price: 350000, itemType: 'SECOND_HAND', condition: 'ດີຫຼາຍ (90%+)', pickupLocation: 'ຕຶກ IT',
      text: 'ປ່ຽນມາໃຊ້ Trackpad ເລີຍຂາຍຕໍ່.', seller: ME, createdAt: minutesAgo(90) }),
  ],

  orders: [],

  messages: [
    { itemId: 2, senderId: S.noy.userId, receiverId: ME.userId, messageText: 'ສະບາຍດີ! ມື້ນີ້ມີກາເຟລາວເຢັນ ສັ່ງໄດ້ເດີ້ ☕', isRead: false, at: 30 },
    { itemId: 2, senderId: S.noy.userId, receiverId: ME.userId, messageText: 'ຖ້າສັ່ງ 2 ແກ້ວ ແຖມຂະໜົມ 1 ຊິ້ນ 😊', isRead: false, at: 28 },
    { itemId: 3, senderId: ME.userId, receiverId: S.keo.userId, messageText: 'iPhone ຍັງຢູ່ບໍ່ ອ້າຍ?', isRead: true, at: 120 },
    { itemId: 3, senderId: S.keo.userId, receiverId: ME.userId, messageText: 'ຍັງຢູ່ເດີ້ ມາລອງເຄື່ອງໄດ້ທີ່ຕຶກ IT ຊັ້ນ 3', isRead: false, at: 115 },
    { itemId: 11, senderId: S.bounmy.userId, receiverId: ME.userId, messageText: 'ເມົ້າ ລົດໄດ້ບໍ່ 300,000?', isRead: true, at: 60 },
  ].map(({ at, ...m }, i) => ({ messageId: i + 1, createdAt: minutesAgo(at), ...m })),
}

let seq = 1000
export const nextId = () => ++seq
