import { Form, Input, Button, Modal, message, Select } from 'antd'
import { useEffect, useState } from 'react'
import { ApiService } from '../../services/api.service'
import moment from 'moment'

const apiService = new ApiService()

const validateMessages = {
    required: 'Обязательное поле!',
    string: { min: 'Минимум 8 символов!' }
}

function Profile(props) {
    const [form] = Form.useForm()
    const [passwordForm] = Form.useForm()
    const [userInfo, setUserInfo] = useState(null)
    const [passwordModalVisible, setPasswordModalVisible] = useState(false)
    const [allSkills, setAllSkills] = useState([])

    const isVolunteer = props.currentUserInfo.role === 'vol';

    async function fetchUserInfo() {
        const id   = props.currentUserInfo.id;
        const role = props.currentUserInfo.role;
        const endpoint = role === 'vol'
          ? `/volunteer/${id}`
          : `/organizer/${id}`;
    
        try {
            // профиль + список навыков параллельно
            const [profileResp, skillsResp] = await Promise.all([
                apiService.get(endpoint),
                apiService.get('/skills'),
            ]);
            setAllSkills(skillsResp);
            setUserInfo(profileResp);
            // начальные значения формы
            form.setFieldsValue({
                ...profileResp,
                date_of_birth: profileResp.date_of_birth
                    ? moment(profileResp.date_of_birth).format('YYYY-MM-DD')
                    : null,
                // строковые навыки -> id
                skills: profileResp.skills
                    ? profileResp.skills.map(str => {
                        const found = skillsResp.find(k => k.skill === str);
                        return found ? found.id : null;
                    })
                    .filter(Boolean)
                    : [],
            });
        } catch (err) {
          message.error('Не удалось загрузить информацию пользователя');
        }
    }

    async function updateUserInfo(values) {
        const id   = props.currentUserInfo.id;
        const role = props.currentUserInfo.role;
        const endpoint = role === 'vol'
            ? `/volunteer/${id}/update`
            : `/organizer/${id}/update`;
    
        if (isVolunteer) {
            values.skills = values.skills || []; // массив skillId
        } else {
            delete values.skills;
        }
    
        apiService.post(endpoint, values)
            .then(resp => {
                if (resp.success) {
                    message.success('Информация обновлена');
                    setUserInfo(resp.profile); // сразу обновляем стейт
                } else {
                    message.error('Сервер вернул ошибку');
                }
            })
            .catch(() => message.error('Не удалось обновить информацию'));
    }

    async function updatePassword(values) {
        const userId = props.currentUserInfo.id
        apiService.post(`/user/${userId}/updatePassword`, values).then(() => {
            setPasswordModalVisible(false)
            message.success('Пароль обновлен')
            passwordForm.resetFields();
        }).catch(() => {
            message.error('Не удалось обновить пароль')
        })
    }

    const handleEmailChange = (changedValues) => {
        if (changedValues.email) {
            Modal.confirm({
                title: 'Изменение email',
                content: 'Email используется в качестве логина. Вы уверены, что хотите изменить его?',
                onOk: () => updateUserInfo(form.getFieldsValue()),
                onCancel: () => form.setFieldsValue({ email: userInfo.email }),
            })
        }
    }

    useEffect(() => {
        fetchUserInfo()
    }, [])

    if (!userInfo) {
        return <div>Loading...</div>;
    }
    return (
        <div className='profile-page'>
            <div className='profile-form-wrapper'>
                <h1 style={{ textAlign: 'center' }}> Личный кабинет </h1>
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={updateUserInfo}
                    onValuesChange={handleEmailChange}
                    validateMessages={validateMessages}
                >
                    {userInfo.image_path ? (
                        <div style={{display: 'flex', justifyContent: 'center', flexWrap: 'wrap'}}>
                            <img alt="Profile Image" src={userInfo.image_path}
                                 style={{
                                     width: 'auto',
                                     maxHeight: '300px',
                                     borderRadius: '10px',
                                     boxShadow: '0 4px 8px rgba(0,0,0,0.4)'
                                 }}/>
                        </div>
                    ) : (
                        <p>No images available.</p>
                    )}
                    <Form.Item label="Имя" name="first_name" rules={[{required: true}]}>
                        <Input/>
                    </Form.Item>
                    <Form.Item label="Фамилия" name="last_name" rules={[{required: true}]}>
                        <Input/>
                    </Form.Item>
                    <Form.Item label="Отчество" name="patronymic">
                        <Input/>
                    </Form.Item>
                    <Form.Item label="Электронная почта - Логин" name="email" rules={[{required: true}]}>
                        <Input/>
                    </Form.Item>
                    <Form.Item label="Номер телефона" name="phone_number" >
                        <Input/>
                    </Form.Item>
                    <Form.Item label="Описание" name="description">
                        <Input.TextArea/>
                    </Form.Item>
                    <Form.Item label="Дата рождения" name="date_of_birth" rules={[{ required: true }]}>
                        <Input
                            type="date"
                            onChange={e => form.setFieldsValue({ date_of_birth: e.target.value })}
                            value={form.getFieldValue('date_of_birth')}
                        />
                    </Form.Item>
                    <Form.Item label="URL фотографии" name="image_path">
                        <Input/>
                    </Form.Item>
                    {props.currentUserInfo.role === 'vol' && (
                        <>
                            <Form.Item label="Навыки" name="skills">
                                <Select // возможно сделать как в Event
                                    mode="multiple"
                                    placeholder="Выберите навыки"
                                    options={allSkills.map(k => ({ value: k.id, label: k.skill }))}
                                />
                            </Form.Item>
                            <Form.Item label="Количество посещенных мероприятий" name="num_attended_events">
                                <Input type="number" />
                            </Form.Item>
                            <Form.Item label="Волонтерские часы" name="volunteer_hours">
                                <Input type="number" />
                            </Form.Item>
                        </>
                    )}
                    {props.currentUserInfo.role === 'org' && (
                        <>
                            <Form.Item label="Образование" name="education">
                                <Input/>
                            </Form.Item>
                            <Form.Item label="Опыт работы" name="work_experience">
                                <Input/>
                            </Form.Item>
                        </>
                    )}
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                        <Button type="primary" onClick={() => setPasswordModalVisible(true)}>
                            Сменить пароль
                        </Button>
                        <Button type="primary" htmlType="submit">
                            Сохранить изменения
                        </Button>
                    </div>
                </Form>
                <Modal
                    title="Сменить пароль"
                    open={passwordModalVisible}
                    onCancel={() => setPasswordModalVisible(false)}
                    footer={null}
                >
                    <Form
                        form={passwordForm}
                        layout="vertical"
                        onFinish={updatePassword}
                        validateMessages={validateMessages}
                    >
                        <Form.Item label="Текущий пароль" name="currentPassword" rules={[{ required: true }]}>
                            <Input.Password />
                        </Form.Item>
                        <Form.Item label="Новый пароль" name="newPassword" rules={[{ required: true, min: 8 }]}>
                            <Input.Password />
                        </Form.Item>
                        <Form.Item
                            label="Повторите новый пароль"
                            name="passwordRepeat"
                            rules={[
                                { required: true },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        if (!value || getFieldValue('newPassword') === value) {
                                            return Promise.resolve();
                                        }
                                        return Promise.reject(new Error('Пароли не совпадают'));
                                    },
                                }),
                            ]}
                        >
                            <Input.Password />
                        </Form.Item>
                        <Button type="primary" htmlType="submit">
                            Изменить пароль
                        </Button>
                    </Form>
                </Modal>
            </div>
        </div>
    )
}

export default Profile
