import httpStatus from 'http-status';
import nock from 'nock';

export function mockApiAvatarUpload(data) {
  nock(process.env.API_SERVICE_ENDPOINT)
    .post(`/api/uploads/avatar/`, data)
    .reply(httpStatus.OK, {
      data: {
        url: 'https://circles-ubi-development.s3.amazonaws.com/uploads/avatars/e38d4d9365b9a48cd0f2a3e1cddb1c5cc1da5a8282cbc61fe949dbb017c4d52d.jpg',
      },
    });
}

export function mockApiAvatarDelete(url) {
  nock(process.env.API_SERVICE_ENDPOINT)
    .delete(`/api/uploads/avatar/`, {
      url,
    })
    .reply(httpStatus.OK);
}
